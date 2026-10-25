/**
 * Comparação de cenários (§13): conservador / base / otimista.
 * Cada cenário aplica overrides ao mesmo PricingInput e usa o MESMO motor (`calculate`),
 * garantindo que não haja fórmula paralela (prompt §13/§20).
 */
import type { PricingInput, PricingResult } from '../contracts/types.js';
import { calculate } from '../calculations/calculate.js';

export type ScenarioName = 'conservador' | 'base' | 'otimista' | string;

export interface ScenarioOverride {
  readonly name: ScenarioName;
  readonly volume?: Partial<PricingInput['volume']>;
  readonly negotiation?: Partial<PricingInput['negotiation']>;
}

export interface ScenarioResult {
  readonly name: ScenarioName;
  readonly input: PricingInput;
  readonly result: PricingResult;
}

export function applyScenario(base: PricingInput, ov: ScenarioOverride): PricingInput {
  return {
    ...base,
    volume: { ...base.volume, ...(ov.volume ?? {}) },
    negotiation: { ...base.negotiation, ...(ov.negotiation ?? {}) },
  };
}

export function runScenarios(base: PricingInput, overrides: readonly ScenarioOverride[]): ScenarioResult[] {
  return overrides.map((ov) => {
    const input = applyScenario(base, ov);
    return { name: ov.name, input, result: calculate(input) };
  });
}

/** Trio padrão: conservador (−30% MAU), base, otimista (+30% MAU). */
export function defaultScenarios(base: PricingInput): ScenarioResult[] {
  const mau = base.volume.mauPct;
  return runScenarios(base, [
    { name: 'conservador', volume: { mauPct: Math.max(0, mau * 0.7) } },
    { name: 'base' },
    { name: 'otimista', volume: { mauPct: Math.min(1, mau * 1.3) } },
  ]);
}
