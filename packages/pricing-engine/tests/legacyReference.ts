/**
 * Reimplementação FIEL do `calc()` do HTML legado (Bondly_2027_Simulador_Comercial_V1.0.html),
 * usada apenas como ORÁCULO do teste de paridade (prompt §22). Copiada o mais próximo possível do
 * original, com as mesmas constantes e ordem de operações.
 */

const PBANDS: [number, number, number][] = [
  [0, 25000, 0.5],
  [25000, 50000, 0.47 + 0.015],
  [50000, 150000, 0.47],
  [150000, 250000, 0.455],
  [250000, 1e12, 0.445],
];
// nota: usar os literais exatos do HTML
const PBANDS_EXACT: [number, number, number][] = [
  [0, 25000, 0.5],
  [25000, 50000, 0.485],
  [50000, 150000, 0.47],
  [150000, 250000, 0.455],
  [250000, 1e12, 0.445],
];
void PBANDS;

function pfBand(u: number): number {
  let s = 0;
  for (const [a, b, p] of PBANDS_EXACT) if (u > a) s += (Math.min(u, b) - a) * p;
  return s;
}

const TIERS = [
  { n: 'Starter', u: 25000, pf: 12500, setup: 40000 },
  { n: 'Growth', u: 50000, pf: 24625, setup: 60000 },
  { n: 'Scale', u: 150000, pf: 71625, setup: 100000 },
  { n: 'Enterprise', u: 250000, pf: 117125, setup: 140000 },
  { n: 'Enterprise+', u: 400000, pf: 183875, setup: 180000 },
];

const BANDS: [number, number, number][] = [
  [0, 5000, 0.08],
  [5000, 15000, 0.06],
  [15000, 40000, 0.045],
  [40000, 80000, 0.035],
  [80000, Infinity, 0.025],
];

const C = {
  clever: 0.0633,
  nf: 0.12,
  termDisc: { 12: 0, 24: 0.05, 36: 0.1 } as Record<number, number>,
  infra: 0.1462,
  proc: 0.3,
  hour: 350,
  tax: 0.117,
  feeConv: 0.15,
  feeAM: 0.05,
  setupMk: 0.2,
  target: 0.7,
  floor: 0.6,
  rcs: 0.056,
  wa: 0.7,
  sms: 0.15,
  email: 0.15,
};

const BANDSCX = [
  { n: 'Padrão', max: 25, setup: 1, mk: 0, mkp: 0.1 },
  { n: 'Avançado', max: 50, setup: 1.15, mk: 0.075, mkp: 0.15 },
  { n: 'Complexo', max: 75, setup: 1.3, mk: 0.15, mkp: 0.25 },
  { n: 'Estratégico / Alta complexidade', max: 101, setup: 1.5, mk: 0.25, mkp: 0.35 },
];

function usagePerDay(dau: number): number {
  let s = 0;
  for (const [a, b, p] of BANDS) if (dau > a) s += (Math.min(dau, b) - a) * p;
  return s;
}
function tierFor(u: number) {
  return TIERS.find((t) => u <= t.u) || TIERS[TIERS.length - 1]!;
}
function cogsFor(mau: number, tx: number, nf: number, comm: number, cpm: number): number {
  return mau * C.clever + mau * nf * C.nf + mau * tx * C.infra + mau * cpm * comm;
}

export interface LegacyScenario {
  users: number;
  mauPct: number; // 0..100
  stick: number; // 0..100
  tx: number;
  nfOn: boolean;
  nfPct: number; // 0..100
  nfQty: number;
  comm: 'fallback' | 'rcs' | 'wa' | 'sms' | 'email' | 'both' | 'none';
  fb: number; // 0..100
  cpm: number;
  integ: number;
  mods: number;
  sla: number;
  custom: number;
  ai: number;
  migr: number;
  implh: number;
  opt: 0.9 | 1 | 1.1;
  disc: number; // 0..30 (%)
  term: 12 | 24 | 36;
  via: boolean;
  exp: boolean;
  key: boolean;
}

function commUnit(strat: string, fb: number): number {
  return strat === 'none'
    ? 0
    : strat === 'rcs'
      ? C.rcs
      : strat === 'wa'
        ? C.wa
        : strat === 'sms'
          ? C.sms
          : strat === 'email'
            ? C.email
            : strat === 'both'
              ? C.rcs + C.wa
              : C.rcs + C.wa * fb;
}

function complexity(s: LegacyScenario) {
  const parts: number[] = [
    (Math.min(s.integ, 5) / 5) * 20,
    (Math.min(Math.max(s.mods - 1, 0), 5) / 5) * 15,
    s.sla,
    s.custom,
    s.ai,
    s.migr,
  ];
  const score = parts.reduce((a, b) => a + b, 0);
  const band = BANDSCX.find((b) => score < b.max)!;
  return { score, band };
}

/** Reproduz `calc()` para os campos que o teste de paridade compara. */
export function legacyCalc(s: LegacyScenario) {
  const nf = s.nfOn ? (Math.max(0, Math.min(100, s.nfPct)) / 100) * Math.max(0, Math.round(s.nfQty)) : 0;
  const fb = Math.max(0, Math.min(1, s.fb / 100));
  const comm = commUnit(s.comm, fb);
  const disc = Math.max(0, s.disc) / 100;
  const term = s.term;
  const t = tierFor(s.users);
  const mau = s.users * (s.mauPct / 100);
  const dau = mau * (s.stick / 100);
  const usage = usagePerDay(dau) * 30;
  const proc = mau * s.tx * C.proc;
  const cx = complexity(s);
  const pfTable = pfBand(s.users);
  const usage0 = usagePerDay(mau * (s.stick / 100)) * 30;
  const proc0 = mau * s.tx * C.proc;
  const cogs0 = cogsFor(mau, s.tx, nf, comm, s.cpm);
  const pfFloorEcon = Math.max(0, cogs0 / (1 - C.floor) - usage0 - proc0);
  const pfPiso = Math.max(pfTable * 0.9, pfFloorEcon);
  const pfRec = Math.max(pfPiso, pfTable * (1 + cx.band.mk));
  const pfPrem = Math.max(pfRec, pfTable * (1 + cx.band.mkp));
  const pfOpt = s.opt === 0.9 ? pfPiso : s.opt === 1 ? pfRec : pfPrem;
  const tdisc = C.termDisc[term] || 0;
  const pf = pfOpt * (1 - disc) * (1 - tdisc);
  const core = pf + usage + proc;
  const cogs = cogsFor(mau, s.tx, nf, comm, s.cpm);
  const margin = core > 0 ? (core - cogs) / core : 0;

  // Serviços sem perfis preenchidos (teste de paridade foca no core)
  const services = 0;
  const implCost = s.implh * C.hour; // hprice default = href = 350 quando sem perfis negociados
  const setupRec = t.setup * cx.band.setup;
  const setupTable = s.opt === 0.9 ? t.setup * 0.9 : s.opt === 1 ? setupRec : setupRec * 1.15;
  const setupNet = setupTable + implCost;
  const setupClient = setupNet * (s.via ? 1 + C.setupMk : 1);
  const feeConv = s.via ? pf * C.feeConv : 0;
  const feeAM = s.via ? pf * C.feeAM : 0;
  const netY1 = core > 0 ? (core - cogs - core * C.tax - feeConv - feeAM) / core : 0;
  const netSteady = core > 0 ? (core - cogs - core * C.tax - feeAM) / core : 0;
  const minuY1 = s.via ? (feeConv + feeAM) * 12 + setupNet * C.setupMk : 0;
  const clientY1 = (core + services) * 12 + setupClient;
  const tcvClient = (core + services) * term + setupClient;
  const tcvBondly = (core + services) * term + setupNet;
  const kRev = (core + services) * term;
  const kCogs = cogs * term;
  const kTax = (core + services) * C.tax * term;
  const kFees = feeConv * Math.min(12, term) + feeAM * term;
  // sv.cost=0, implh*sv.hcost: hcost default = cap/hprod = 25000/160
  const hcost = 25000 / 160;
  const kContrib =
    kRev + setupNet - kCogs - kTax - kFees + 0 - setupNet * C.tax - 0 * term - s.implh * hcost;
  const minuContract = s.via ? feeConv * Math.min(12, term) + feeAM * term + setupNet * C.setupMk : 0;

  return {
    tierName: t.n + (s.users > 400000 ? ' · custom' : ''),
    mau,
    dau,
    pfTable,
    pf,
    usage,
    proc,
    core,
    cogs,
    margin,
    setupNet,
    setupClient,
    netY1,
    netSteady,
    minuY1,
    clientY1,
    tcvClient,
    tcvBondly,
    kContrib,
    minuContract,
    score: cx.score,
    band: cx.band.n,
  };
}
