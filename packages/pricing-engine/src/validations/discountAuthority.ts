/** Corredor de desconto e alçada (R-017). */
import type { PremiseTable } from '../premises/premises.js';

export interface DiscountAuthorityResult {
  readonly maxDiscount: number;
  readonly authority: string;
  readonly severity: 'info' | 'warn' | 'error';
}

/**
 * Corredor máximo (R-017): min(cap, base + expansão?step + estratégico?step).
 * Alçada por faixa do desconto pedido:
 *   > corredor → Exceção formal · >10% CEO+Financeiro · >5% Head/Diretor · senão Comercial.
 */
export function discountAuthority(args: {
  requestedDiscount: number;
  expansion: boolean;
  strategic: boolean;
  table: PremiseTable;
}): DiscountAuthorityResult {
  const { requestedDiscount, expansion, strategic, table } = args;
  const step = table.discountCorridorStrategicStep.value;
  const maxDiscount = Math.min(
    table.discountCorridorCap.value,
    table.discountCorridorBase.value + (expansion ? step : 0) + (strategic ? step : 0),
  );
  if (requestedDiscount > maxDiscount) {
    return {
      maxDiscount,
      authority: `Exceção formal — acima do corredor de ${(maxDiscount * 100).toFixed(1)}%`,
      severity: 'error',
    };
  }
  if (requestedDiscount > 0.1) return { maxDiscount, authority: 'CEO + Financeiro', severity: 'warn' };
  if (requestedDiscount > 0.05) return { maxDiscount, authority: 'Head / Diretor', severity: 'warn' };
  return { maxDiscount, authority: 'Comercial', severity: 'info' };
}
