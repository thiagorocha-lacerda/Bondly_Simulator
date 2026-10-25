import { useCallback, useMemo, useState } from 'react';
import { normalizeB2cInput, CURRENT_PREMISES, type B2cInput } from '@bondly/pricing-engine';

const KEY = 'bondly-ws-b2c';
const INCLUDE_KEY = 'bondly-ws-b2c-include';

export const B2C_DEFAULTS: Partial<B2cInput> = {
  som: 2_400_000,
  conv: 0.01,
  ticket: 10,
  churn: 0.08,
  fee: 0.1,
  gateway: 0.05,
  tax: 0.15,
  minFee: 2,
  minuShare: 0.5,
  commission: 0,
  method: 'progressiva',
  scope: 'primeira',
  validation: 0,
  cardReuse: 0.005,
  setup: 3000,
  minMargin: 1500,
  addCost: 0,
  weights: [10, 14, 17, 19, 20, 20],
};

function loadRaw(): Partial<B2cInput> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...B2C_DEFAULTS, ...(JSON.parse(raw) as Partial<B2cInput>) } : B2C_DEFAULTS;
  } catch {
    return B2C_DEFAULTS;
  }
}

function loadInclude(): boolean {
  try {
    return localStorage.getItem(INCLUDE_KEY) === '1';
  } catch {
    return false;
  }
}

export interface UseB2c {
  readonly raw: Partial<B2cInput>;
  readonly input: B2cInput; // normalizado
  readonly include: boolean; // entra no snapshot/PDF da proposta?
  set: (patch: Partial<B2cInput>) => void;
  setInclude: (on: boolean) => void;
}

/**
 * Fonte ÚNICA do estado B2C (§7.5). O painel edita e o fluxo de proposta (PreviewModal) lê o MESMO
 * estado — assim o funil B2C entra no snapshot/PDF quando `include` está ligado. Persistência local.
 */
export function useB2c(): UseB2c {
  const [raw, setRaw] = useState<Partial<B2cInput>>(loadRaw);
  const [include, setIncludeState] = useState<boolean>(loadInclude);

  const set = useCallback((patch: Partial<B2cInput>) => {
    setRaw((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const setInclude = useCallback((on: boolean) => {
    setIncludeState(on);
    try {
      localStorage.setItem(INCLUDE_KEY, on ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const input = useMemo(() => normalizeB2cInput(raw, CURRENT_PREMISES), [raw]);

  return { raw, input, include, set, setInclude };
}
