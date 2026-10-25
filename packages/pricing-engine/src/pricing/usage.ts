/** DAU Usage (R-003), Processing (R-004), Tier (R-002), Engajamento (R-008/R-009). */
import type { Band, TierDefinition } from '../premises/premises.js';

/** Usage por dia — soma progressiva das faixas de DAU (R-003). */
export function usagePerDay(dau: number, bands: readonly Band[]): number {
  let sum = 0;
  for (const [from, to, unit] of bands) {
    if (dau > from) sum += (Math.min(dau, to) - from) * unit;
  }
  return sum;
}

/** DAU Usage mensal = usagePerDay × 30 (R-003). */
export function monthlyUsage(dau: number, bands: readonly Band[]): number {
  return usagePerDay(dau, bands) * 30;
}

/** Processing mensal (R-004). */
export function processing(mau: number, transactionsPerMau: number, ratePerTx: number): number {
  return mau * transactionsPerMau * ratePerTx;
}

/** MAU (R-008). */
export function mauOf(users: number, mauPct: number): number {
  return users * mauPct;
}

/** DAU (R-009). */
export function dauOf(mau: number, stickiness: number): number {
  return mau * stickiness;
}

/** Seleciona o tier (R-002): menor tier cujo teto ≥ usuários; senão o maior (customizado). */
export function tierFor(users: number, tiers: readonly TierDefinition[]): TierDefinition {
  return tiers.find((t) => users <= t.users) ?? tiers[tiers.length - 1]!;
}
