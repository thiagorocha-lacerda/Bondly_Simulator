import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Fonte ÚNICA de audience (§12/§16) — a confidencialidade da proposta.
 *
 * 'internal' (visão interna) = squad Bondly: pode ver custos, margens, resultado B2C, ARKA.
 * 'external' (visão comercial) = o que pode ser mostrado/compartilhado com o cliente.
 *
 * Toda superfície sensível DEVE ler `internal` deste contexto em vez de receber um prop próprio.
 * Centralizar aqui evita a recaída de um painel novo esquecer de esconder um número interno:
 * não há prop para esquecer de passar — o componente chama `useAudience()`.
 */
export type Audience = 'internal' | 'external';

const KEY = 'bondly-ws-audience';

interface AudienceContextValue {
  readonly audience: Audience;
  readonly internal: boolean;
  setAudience: (a: Audience) => void;
}

const AudienceContext = createContext<AudienceContextValue | null>(null);

function load(): Audience {
  try {
    return localStorage.getItem(KEY) === 'external' ? 'external' : 'internal';
  } catch {
    return 'internal';
  }
}

export function AudienceProvider(props: { children: ReactNode; initial?: Audience }) {
  const [audience, setAudienceState] = useState<Audience>(() => props.initial ?? load());

  const setAudience = useCallback((a: Audience) => {
    setAudienceState(a);
    try {
      localStorage.setItem(KEY, a);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<AudienceContextValue>(
    () => ({ audience, internal: audience === 'internal', setAudience }),
    [audience, setAudience],
  );

  return <AudienceContext.Provider value={value}>{props.children}</AudienceContext.Provider>;
}

/**
 * Lê a audience atual. Usar `internal` para decidir se um número sensível pode aparecer.
 * Lançar fora do provider é intencional: força toda superfície a viver sob o AudienceProvider,
 * fechando o buraco de um componente renderizado sem controle de audience.
 */
export function useAudience(): AudienceContextValue {
  const ctx = useContext(AudienceContext);
  if (!ctx) throw new Error('useAudience precisa estar dentro de <AudienceProvider>.');
  return ctx;
}
