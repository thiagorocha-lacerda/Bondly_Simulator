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
 */
export function complexity(p: ComplexityParameters, bands: readonly ComplexityBand[]): ComplexityResult {
  const parts: ComplexityPart[] = [
    { name: 'Integrações', value: (Math.min(p.integrations, 5) / 5) * 20, max: 20 },
    { name: 'Módulos', value: (Math.min(Math.max(p.modules - 1, 0), 5) / 5) * 15, max: 15 },
    { name: 'SLA', value: p.slaPoints, max: 15 },
    { name: 'Customização', value: p.customizationPoints, max: 20 },
    { name: 'AI', value: p.aiPoints, max: 15 },
    { name: 'Migração', value: p.migrationPoints, max: 15 },
  ];
  const score = parts.reduce((s, part) => s + part.value, 0);
  const band = bands.find((b) => score < b.maxScore) ?? bands[bands.length - 1]!;
  return { parts, score, band };
}
