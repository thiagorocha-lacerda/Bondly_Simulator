/** Margem técnica, guardrails e margem líquida (R-018, R-019, R-024). */
import type { MarginStatus } from '../contracts/types.js';

/** Margem técnica (R-018): (core − cogs) / core. */
export function technicalMargin(core: number, cogs: number): number {
  return core > 0 ? (core - cogs) / core : 0;
}

/**
 * Status de margem (R-019), reproduzindo a lógica de `render()`:
 *   incompleto (MAU<=0) · customizado (users>400k) · ≥target SAUDÁVEL · ≥floor REVISAR · else REPRECIFICAR.
 */
export function marginStatus(args: {
  margin: number;
  mau: number;
  users: number;
  target: number;
  floor: number;
  maxTierUsers: number;
}): MarginStatus {
  const { margin, mau, users, target, floor, maxTierUsers } = args;
  if (mau <= 0) return 'INCOMPLETO';
  if (users > maxTierUsers) return 'CUSTOMIZADO';
  if (margin >= target) return 'SAUDÁVEL';
  if (margin >= floor) return 'REVISAR';
  return 'REPRECIFICAR';
}

/**
 * Margem líquida (R-024), reproduzindo `netY1`/`netSteady`:
 *   Y1 = (core − cogs − core×tax − feeConv − feeAM) / core
 *   regime = (core − cogs − core×tax − feeAM) / core   (sem feeConv)
 */
export function netMargin(args: {
  core: number;
  cogs: number;
  taxRate: number;
  conversionFee: number;
  accountFee: number;
}): { readonly year1: number; readonly steady: number } {
  const { core, cogs, taxRate, conversionFee, accountFee } = args;
  if (core <= 0) return { year1: 0, steady: 0 };
  const year1 = (core - cogs - core * taxRate - conversionFee - accountFee) / core;
  const steady = (core - cogs - core * taxRate - accountFee) / core;
  return { year1, steady };
}
