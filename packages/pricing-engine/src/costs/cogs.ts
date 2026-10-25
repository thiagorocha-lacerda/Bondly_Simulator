/** Custo variável (COGS, R-005) e notas fiscais (R-007). */
import type { CostBreakdown } from '../contracts/types.js';

/**
 * NF por MAU (R-007): fração de participantes × notas por participante, quando a leitura está ativa.
 * Retorna o fator `nf` que multiplica o MAU (notas estimadas = MAU × nf).
 */
export function invoicesFactor(enabled: boolean, participantPct: number, notesPerParticipant: number): number {
  if (!enabled) return 0;
  const pct = Math.max(0, Math.min(1, participantPct));
  const qty = Math.max(0, Math.round(notesPerParticipant));
  return pct * qty;
}

/**
 * Custo variável mensal (R-005), reproduzindo `cogsFor()`:
 *   MAU×cleverTap + MAU×nf×custoNF + MAU×tx×infra + MAU×cpm×commUnit
 */
export function cogs(args: {
  mau: number;
  transactionsPerMau: number;
  invoicesFactor: number;
  communicationUnit: number;
  communicationsPerMau: number;
  cleverTapPerMau: number;
  invoiceReadCost: number;
  infraPerTransaction: number;
}): CostBreakdown {
  const {
    mau,
    transactionsPerMau,
    invoicesFactor: nf,
    communicationUnit,
    communicationsPerMau,
    cleverTapPerMau,
    invoiceReadCost,
    infraPerTransaction,
  } = args;
  const cleverTap = mau * cleverTapPerMau;
  const invoices = mau * nf * invoiceReadCost;
  const infra = mau * transactionsPerMau * infraPerTransaction;
  const communication = mau * communicationsPerMau * communicationUnit;
  return { cleverTap, infra, invoices, communication, total: cleverTap + invoices + infra + communication };
}
