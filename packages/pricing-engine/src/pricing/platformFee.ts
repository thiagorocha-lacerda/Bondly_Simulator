/** Platform Fee progressivo e derivados (R-001, R-013, R-014, R-016). */
import type { Band, PremiseTable } from '../premises/premises.js';
import type { CommercialOption } from '../contracts/types.js';
import type { ComplexityResult } from './complexity.js';

/** Platform Fee de tabela — soma progressiva por faixa de usuários (R-001). */
export function platformFeeTable(users: number, bands: readonly Band[]): number {
  let sum = 0;
  for (const [from, to, unit] of bands) {
    if (users > from) sum += (Math.min(users, to) - from) * unit;
  }
  return sum;
}

export interface PlatformFeeResolution {
  readonly table: number;
  readonly floor: number;
  readonly recommended: number;
  readonly premium: number;
  readonly chosen: number; // antes de descontos
  readonly optionMultiplier: number;
  readonly final: number; // após desconto negociado e por prazo
}

/**
 * Resolve o Platform Fee para as três opções comerciais e aplica descontos (R-013/R-014/R-016).
 * - pfPiso  = max(tabela×0.9, piso econômico pela margem floor)
 * - pfRec   = max(pfPiso, tabela×(1+markup))
 * - pfPrem  = max(pfRec, tabela×(1+markupPremium))
 * - final   = escolhido × (1−descontoNegociado) × (1−descontoPrazo)
 */
export function resolvePlatformFee(args: {
  table: number;
  floorEconomic: number; // cogs0/(1-floor) - usage0 - proc0
  complexity: ComplexityResult;
  option: CommercialOption;
  extraDiscount: number;
  termDiscount: number;
}): PlatformFeeResolution {
  const { table, floorEconomic, complexity, option, extraDiscount, termDiscount } = args;
  const floor = Math.max(table * 0.9, floorEconomic);
  const recommended = Math.max(floor, table * (1 + complexity.band.markup));
  const premium = Math.max(recommended, table * (1 + complexity.band.markupPremium));

  const chosen = option === 'floor' ? floor : option === 'recommended' ? recommended : premium;
  const optionMultiplier = table ? chosen / table : 1;
  const final = chosen * (1 - extraDiscount) * (1 - termDiscount);

  return { table, floor, recommended, premium, chosen, optionMultiplier, final };
}

/** Piso econômico do PF dado um alvo de margem (R-013 usa floor; reusado para o alvo). */
export function economicFloor(args: {
  cogs: number;
  usage: number;
  processing: number;
  marginTarget: number;
}): number {
  const { cogs, usage, processing, marginTarget } = args;
  return Math.max(0, cogs / (1 - marginTarget) - usage - processing);
}

export function termDiscountFor(term: 12 | 24 | 36, table: PremiseTable): number {
  return table.termDiscounts.value[term] ?? 0;
}
