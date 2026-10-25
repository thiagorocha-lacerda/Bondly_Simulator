/**
 * Política monetária e de precisão (prompt §5.3).
 *
 * Decisão de arquitetura — paridade com o HTML legado:
 * O simulador original calcula em ponto flutuante de precisão plena e só arredonda na APRESENTAÇÃO
 * (`Math.round` dentro de `brl()`), nunca em passos intermediários. Para garantir que "para entradas
 * equivalentes os resultados coincidem" (prompt §22), o motor segue a MESMA ordem de cálculo:
 *
 *   - Aritmética interna: `number` (float64) em plena precisão, SEM arredondamentos intermediários.
 *   - Arredondamento: aplicado apenas na borda de apresentação, via `roundCurrency`.
 *   - Percentuais: mantidos como frações [0,1] internamente.
 *
 * Isto evita "arredondamentos intermediários arbitrários" (proibidos pelo §5.3) e mantém o motor
 * determinístico: mesma entrada + mesma versão de premissas ⇒ mesma saída.
 */

/** Arredonda um valor monetário para o inteiro de reais mais próximo (política de apresentação). */
export function roundCurrency(value: number): number {
  return Math.round(value);
}

/** Converte reais (float) para centavos inteiros — útil para persistência/comparação exata. */
export function toCents(reais: number): number {
  return Math.round(reais * 100);
}

/** Converte centavos inteiros de volta para reais. */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** Garante que um número é finito; caso contrário retorna o fallback (default 0). */
export function finiteOr(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

/** Limita um número ao intervalo [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Converte um percentual humano (0–100) para fração [0,1], com piso em 0. */
export function pctToFraction(pct: number): number {
  return Math.max(0, finiteOr(pct) / 100);
}
