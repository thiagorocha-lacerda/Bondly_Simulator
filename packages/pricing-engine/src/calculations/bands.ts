/** Primitivas puras de faixas progressivas (§5.2), fiéis à semântica do HTML. */
import type { Band } from '../premises/premises.js';

/** Soma progressiva marginal (`pfBand`/`usagePerDay`): Σ (min(v,b)−a)×rate para v>a. */
export function progressiveSum(value: number, bands: readonly Band[]): number {
  let s = 0;
  for (const [a, b, rate] of bands) if (value > a) s += (Math.min(value, b) - a) * rate;
  return s;
}

/** Soma progressiva inclusiva (antifraude B2C `b2cAF`): Σ (min(v,b)−a+1)×rate para v≥a; faixas iniciam em 1. */
export function progressiveSumInclusive(value: number, bands: readonly Band[]): number {
  let s = 0;
  if (value <= 0) return 0;
  for (const [a, b, rate] of bands) if (value >= a) s += (Math.min(value, b) - a + 1) * rate;
  return s;
}

/** Valor unitário da maior faixa atingida (modo "integral" da antifraude B2C). */
export function bandRateIntegral(value: number, bands: readonly Band[]): number {
  let rate = 0;
  for (const [a, , r] of bands) if (a <= value) rate = r;
  return value >= 1 ? value * rate : 0;
}

/** Arredonda para cima ao próximo múltiplo de `step`, com tolerância a float. */
export function ceilTo(value: number, step: number): number {
  return Math.ceil(value / step - 1e-9) * step;
}
