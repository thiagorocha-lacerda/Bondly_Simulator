import { useCallback, useEffect, useMemo, useState } from 'react';
import { calculate, type PricingInput, type PricingResult } from '@bondly/pricing-engine';
import { DEFAULT_INPUT } from '../services/defaults';
import type { DeepPartial } from '../services/patch';

const STORAGE_KEY = 'bondly-ws-input';

function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  const out = { ...base } as Record<string, unknown>;
  for (const k of Object.keys(patch) as (keyof T)[]) {
    const pv = patch[k] as unknown;
    const bv = (base as Record<string, unknown>)[k as string];
    out[k as string] =
      pv && typeof pv === 'object' && !Array.isArray(pv) && bv && typeof bv === 'object'
        ? deepMerge(bv, pv as DeepPartial<typeof bv>)
        : pv;
  }
  return out as T;
}

function loadStored(): PricingInput {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_INPUT;
    return deepMerge(DEFAULT_INPUT, JSON.parse(raw) as DeepPartial<PricingInput>);
  } catch {
    return DEFAULT_INPUT;
  }
}

export interface UsePricing {
  readonly input: PricingInput;
  readonly result: PricingResult;
  update: (patch: DeepPartial<PricingInput>) => void;
  reset: () => void;
}

/**
 * Estado central do workspace. Persistência local (Cenário A §27.5): dados ficam só neste navegador,
 * NÃO sincronizados entre usuários/dispositivos. Todo cálculo passa pelo Pricing Engine (§20).
 */
export function usePricing(): UsePricing {
  const [input, setInput] = useState<PricingInput>(loadStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
    } catch {
      /* quota/privado: ignora, dados ficam em memória */
    }
  }, [input]);

  const update = useCallback((patch: DeepPartial<PricingInput>) => {
    setInput((prev) => deepMerge(prev, patch));
  }, []);

  const reset = useCallback(() => {
    setInput(DEFAULT_INPUT);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const result = useMemo(() => calculate(input), [input]);

  return { input, result, update, reset };
}
