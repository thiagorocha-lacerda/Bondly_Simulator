/**
 * Motor de assinaturas B2C (R-060..R-063) — replica `b2cAF()` + `b2cRun()` do HTML.
 * Projeta 6 meses (H2) com churn, apura receita de processamento (fee % com mínimo), gateway,
 * antifraude (faixas Konduto), tributos, e divide o resultado líquido com a Minu.
 */
import type { PremiseTable } from '../premises/premises.js';
import { CURRENT_PREMISES } from '../premises/premises.js';
import { bandRateIntegral, progressiveSumInclusive } from '../calculations/bands.js';
import { clamp } from '../calculations/money.js';

export type AntifraudMethod = 'progressiva' | 'integral';
export type B2cScope = 'primeira' | 'todas';

export interface B2cInput {
  readonly som: number;
  readonly conv: number; // 0..1
  readonly ticket: number;
  readonly churn: number; // 0..1
  readonly fee: number; // fração
  readonly gateway: number; // 0..1
  readonly tax: number; // 0..1
  readonly minFee: number;
  readonly minuShare: number; // 0..1
  readonly commission: number; // 0..1
  readonly method: AntifraudMethod;
  readonly scope: B2cScope;
  readonly validation: number; // 0 | 1
  readonly cardReuse: number; // 0..1
  readonly setup: number;
  readonly minMargin: number;
  readonly addCost: number;
  readonly weights: readonly number[]; // 6 meses
}

export interface B2cMonthRow {
  readonly start: number;
  readonly nw: number;
  readonly canc: number;
  readonly end: number;
  readonly billed: number;
  readonly gmv: number;
  readonly rev: number;
  readonly rev10: number;
  readonly comm: number;
  readonly gw: number;
  readonly vol: number;
  readonly af: number;
  readonly tax: number;
  readonly add: number;
  readonly margin: number;
  readonly minu: number;
  readonly bondly: number;
  readonly commNet: number;
  readonly total: number;
}

export interface B2cResult {
  readonly rows: readonly B2cMonthRow[];
  readonly tot: B2cMonthRow;
  readonly K: number;
  readonly target: number;
}

/** Antifraude por volume (`b2cAF`). */
export function antifraudCost(volume: number, p: B2cInput, table: PremiseTable): number {
  let base = 0;
  if (volume > 0) {
    base =
      p.method === 'integral'
        ? bandRateIntegral(volume, table.b2c.antifraudBands)
        : progressiveSumInclusive(volume, table.b2c.antifraudBands);
  }
  const validation = p.validation ? volume * table.b2c.validationRate : 0;
  return Math.max(p.minMargin, base) + validation;
}

/** Projeção B2C (R-061..R-063), reproduzindo `b2cRun`. */
export function runB2c(p: B2cInput, table: PremiseTable = CURRENT_PREMISES): B2cResult {
  const target = p.som * p.conv;
  const w = p.weights;
  let den = 0;
  for (let m = 0; m < 6; m++) den += (w[m] ?? 0) * Math.pow(1 - p.churn, 5 - m);
  const K = den > 0 ? target / den : 0;

  let start = 0;
  const rows: B2cMonthRow[] = [];
  for (let m = 0; m < 6; m++) {
    const fu = Math.max(p.ticket * p.fee, p.minFee);
    const nw = (w[m] ?? 0) * K;
    const canc = start * p.churn;
    const end = start - canc + nw;
    const billed = end;
    const gmv = billed * p.ticket;
    const rev = billed * fu;
    const rev10 = gmv * p.fee;
    const comm = gmv * p.commission;
    const gw = gmv * p.gateway;
    const vol = p.scope === 'primeira' ? nw + (start - canc) * p.cardReuse : billed;
    const af = antifraudCost(vol, p, table) + (m === 0 ? p.setup : 0);
    const tax = rev * p.tax;
    const margin = rev - gw - af - tax - p.addCost;
    const minu = Math.max(0, margin) * p.minuShare;
    const bondly = margin - minu;
    const commLiq = comm * (1 - p.tax);
    const commNet = commLiq - Math.max(0, commLiq) * p.minuShare;
    rows.push({
      start, nw, canc, end, billed, gmv, rev, rev10, comm, gw, vol, af, tax,
      add: p.addCost, margin, minu, bondly, commNet, total: bondly + commNet,
    });
    start = end;
  }

  const keys = Object.keys(rows[0]!) as (keyof B2cMonthRow)[];
  const tot = {} as Record<keyof B2cMonthRow, number>;
  for (const k of keys) tot[k] = rows.reduce((s, r) => s + r[k], 0);
  tot.end = rows[5]!.end;

  return { rows, tot: tot as B2cMonthRow, K, target };
}

/** Normaliza/valida um input B2C aplicando clamps idênticos ao HTML. */
export function normalizeB2cInput(raw: Partial<B2cInput>, table: PremiseTable = CURRENT_PREMISES): B2cInput {
  const g = (v: number | undefined, d: number): number => (v != null && Number.isFinite(v) ? v : d);
  return {
    som: Math.max(0, g(raw.som, 0)),
    conv: clamp(g(raw.conv, 0), 0, 1),
    ticket: Math.max(0, g(raw.ticket, 0)),
    churn: clamp(g(raw.churn, 0), 0, 1),
    fee: raw.fee ?? table.b2c.feeDefault,
    gateway: clamp(g(raw.gateway, 0), 0, 1),
    tax: clamp(g(raw.tax, 0.15), 0, 1),
    minFee: Math.max(0, g(raw.minFee, table.b2c.minFee)),
    minuShare: clamp(g(raw.minuShare, table.b2c.minuShare), 0, 1),
    commission: clamp(g(raw.commission, 0), 0, 1),
    method: raw.method ?? 'progressiva',
    scope: raw.scope ?? 'primeira',
    validation: raw.validation ?? 0,
    cardReuse: clamp(g(raw.cardReuse, 0), 0, 1),
    setup: Math.max(0, g(raw.setup, 0)),
    minMargin: Math.max(0, g(raw.minMargin, 0)),
    addCost: Math.max(0, g(raw.addCost, 0)),
    weights: (raw.weights ?? [0, 1, 2, 3, 4, 5]).map((x) => Math.max(0, x)),
  };
}
