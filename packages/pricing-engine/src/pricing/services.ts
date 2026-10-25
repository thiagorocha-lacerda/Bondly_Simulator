/** Serviços: recursos dedicados (R-030) e horas adicionais (R-031). Reproduz `svCalc()` do HTML. */
import type { ServiceParameters } from '../contracts/types.js';

export type ServiceStatus = 'g' | 'y' | 'r'; // verde/amarelo/vermelho

export interface ProfileResult {
  readonly index: number;
  readonly name: string;
  readonly quantity: number;
  readonly totalComp: number;
  readonly directCosts: number;
  readonly tablePrice: number;
  readonly pms: number; // Preço Mínimo Sustentável
  readonly pcs: number; // Preço Comercial Sugerido
  readonly price: number; // praticado
  readonly discount: number;
  readonly maxSustainableDiscount: number;
  readonly margin: number; // unitária
  readonly marginPct: number;
  readonly marginTotal: number;
  readonly status: ServiceStatus;
  readonly gap: number; // ajuste até o mínimo
  readonly overCap: boolean;
  readonly tableBelowPms: boolean;
}

export interface ServicesResult {
  readonly net: number; // 1 - tax - passthrough
  readonly profiles: readonly ProfileResult[];
  readonly team: number;
  readonly totalComp: number;
  readonly mrr: number;
  readonly cost: number;
  readonly margin: number;
  readonly belowMin: number;
  // horas
  readonly hourCost: number;
  readonly hourPms: number;
  readonly hourPcs: number;
  readonly hourPrice: number;
  readonly hourMargin: number;
  readonly hourStatus: ServiceStatus;
  readonly implementationHours: number;
  readonly implementationCost: number;
}

const ceilTo = (v: number, step: number): number => Math.ceil(v / step - 1e-9) * step;
const pos = (v: number): number => Math.max(0, v);

/**
 * Serviços (R-030/R-031). `net = 1 − tax − repasses`.
 * Para cada perfil:
 *   PMS = (tc + dc + minMargin) / net
 *   PCS = max(pt≥PMS ? pt : ceil(PMS,100),  target ? ceil((tc+dc+target)/net,100) : 0)
 *   margem = price×net − tc − dc; status: r se margem<min, g se price≥PCS e margem≥alvo, senão y.
 */
export function services(args: {
  params: ServiceParameters;
  taxRate: number;
  tablePriceDefault: number;
  hourlyRate: number;
  implementationHours: number;
  compCapDefault: number;
  productiveHoursDefault: number;
  minMarginDefault: number;
  hourMinMarginDefault: number;
}): ServicesResult {
  const {
    params,
    taxRate,
    tablePriceDefault,
    hourlyRate,
    implementationHours,
    compCapDefault,
    productiveHoursDefault,
    minMarginDefault,
    hourMinMarginDefault,
  } = args;
  const passthrough = Math.min(0.99, pos(params.passthroughPct));
  const net = 1 - taxRate - passthrough;
  const pt0 = pos(params.tablePrice || tablePriceDefault);
  const mmin = pos(params.minMargin || minMarginDefault);
  const cap = pos(params.compCap || compCapDefault);
  const tgtRaw = params.targetMargin != null && params.targetMargin !== undefined ? pos(params.targetMargin) : null;

  const profiles: ProfileResult[] = params.profiles.map((prof, i) => {
    const q = Math.max(0, Math.round(pos(prof.quantity)));
    const tc = pos(prof.totalCompensation);
    const dc = pos(prof.directCosts);
    const pt = prof.tablePrice == null ? pt0 : pos(prof.tablePrice);
    const pms = (tc + dc + mmin) / net;
    const pcs = Math.max(
      pt >= pms ? pt : ceilTo(pms, 100),
      tgtRaw === null ? 0 : ceilTo((tc + dc + tgtRaw) / net, 100),
    );
    const price = prof.negotiatedPrice == null ? pcs : pos(prof.negotiatedPrice);
    const margin = price * net - tc - dc;
    const target = tgtRaw === null ? pcs * net - tc - dc : tgtRaw;
    const status: ServiceStatus =
      margin < mmin - 0.005 ? 'r' : price >= pcs - 0.005 && margin >= target - 0.005 ? 'g' : 'y';
    return {
      index: i,
      name: prof.name || `Perfil ${i + 1}`,
      quantity: q,
      totalComp: tc,
      directCosts: dc,
      tablePrice: pt,
      pms,
      pcs,
      price,
      discount: pt > 0 ? Math.max(0, 1 - price / pt) : 0,
      maxSustainableDiscount: pt > 0 ? Math.max(0, Math.min(1, 1 - pms / pt)) : 0,
      margin,
      marginPct: price > 0 ? margin / price : 0,
      marginTotal: margin * q,
      status,
      gap: Math.max(0, pms - price),
      overCap: tc > cap,
      tableBelowPms: pt < pms,
    };
  });

  const team = profiles.reduce((s, p) => s + p.quantity, 0);
  const totalComp = profiles.reduce((s, p) => s + p.quantity * p.totalComp, 0);
  const mrr = profiles.reduce((s, p) => s + p.quantity * p.price, 0);
  const cost = profiles.reduce((s, p) => s + p.quantity * (p.totalComp + p.directCosts), 0);
  const margin = profiles.reduce((s, p) => s + p.marginTotal, 0);
  const belowMin = profiles.filter((p) => p.quantity > 0 && p.status === 'r').length;

  // Horas adicionais (R-031)
  const hprod = Math.max(1, params.productiveHoursPerMonth || productiveHoursDefault);
  const hourCost = params.hourCost != null ? pos(params.hourCost) : cap / hprod;
  const hmin = pos(params.hourMinMargin || hourMinMarginDefault);
  const hourPms = (hourCost + hmin) / net;
  const hourPcs = hourlyRate >= hourPms ? hourlyRate : Math.ceil(hourPms - 1e-9);
  const hourPrice = params.negotiatedHourPrice != null ? pos(params.negotiatedHourPrice) : hourPcs;
  const hourMargin = hourPrice * net - hourCost;
  const hourStatus: ServiceStatus = hourMargin < hmin - 0.005 ? 'r' : hourPrice >= hourPcs - 0.005 ? 'g' : 'y';
  const hq = pos(implementationHours);

  return {
    net,
    profiles,
    team,
    totalComp,
    mrr,
    cost,
    margin,
    belowMin,
    hourCost,
    hourPms,
    hourPcs,
    hourPrice,
    hourMargin,
    hourStatus,
    implementationHours: hq,
    implementationCost: hq * hourPrice,
  };
}
