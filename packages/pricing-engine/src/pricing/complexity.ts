/** Score de complexidade (R-011) e banda (R-012). */
import type { ComplexityBand } from '../premises/premises.js';
import type { ComplexityParameters } from '../contracts/types.js';

export interface ComplexityPart {
  readonly name: string;
  readonly value: number;
  readonly max: number;
}

export interface ComplexityResult {
  readonly parts: readonly ComplexityPart[];
  readonly score: number;
  readonly band: ComplexityBand;
}

/**
 * Score 0–100 (R-011), reproduzindo `complexity()`:
 *   integrações: min(x,5)/5×20 · módulos: min(max(x-1,0),5)/5×15 · SLA · customização · AI · migração.
 *
 * Blindagem do contrato público (§21): os campos de pontos diretos (SLA/custom/AI/migração) são
 * clampados a [0, max]. A UI só envia valores discretos dentro da faixa, mas o engine é a fronteira
 * para CRM/portal — um consumidor externo poderia mandar valores arbitrários; o clamp garante que
 * cada parte respeite seu teto e o score nunca ultrapasse 100.
 */
export function complexity(p: ComplexityParameters, bands: readonly ComplexityBand[]): ComplexityResult {
  const clampPart = (value: number, max: number): number => Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));
  const parts: ComplexityPart[] = [
    { name: 'Integrações', value: (Math.min(Math.max(p.integrations, 0), 5) / 5) * 20, max: 20 },
    { name: 'Módulos', value: (Math.min(Math.max(p.modules - 1, 0), 5) / 5) * 15, max: 15 },
    { name: 'SLA', value: clampPart(p.slaPoints, 15), max: 15 },
    { name: 'Customização', value: clampPart(p.customizationPoints, 20), max: 20 },
    { name: 'AI', value: clampPart(p.aiPoints, 15), max: 15 },
    { name: 'Migração', value: clampPart(p.migrationPoints, 15), max: 15 },
  ];
  const score = parts.reduce((s, part) => s + part.value, 0);
  const band = bands.find((b) => score < b.maxScore) ?? bands[bands.length - 1]!;
  return { parts, score, band };
}
