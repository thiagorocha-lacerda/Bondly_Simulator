/**
 * Validação do desconto por tier editável (prompt §3.1).
 *
 * Esta é a FRONTEIRA de validação do engine — o §3.1 exige validar "no formulário E no
 * servidor/engine": mínimo 3%, máximo 7%, sem NaN, negativos, strings inválidas ou percentuais
 * fora da faixa. A UI reusa `TIER_DISCOUNT_*` e `validateTierDiscountPct` para a validação inline,
 * de modo que form e engine leem a MESMA regra (nenhum limite duplicado/divergente).
 *
 * Convenção de unidade: a entrada humana é em PONTOS PERCENTUAIS (ex.: 5 = 5,00%); internamente o
 * engine trabalha com FRAÇÃO [0,1] (ex.: 0.05). As funções abaixo convertem e validam explicitamente.
 *
 * Precisão: duas casas decimais em pontos percentuais (ex.: 3,00% … 7,00%). 2,99% e 7,01% são
 * rejeitados; 3,00% e 7,00% são aceitos (limites inclusivos).
 */
import type { TierDiscountLimits } from '../premises/premises.js';

/** Casas decimais aceitas no percentual humano (duas casas → passo de 0,01 p.p.). */
export const TIER_DISCOUNT_DECIMALS = 2;

export type TierDiscountValidation =
  | { readonly ok: true; readonly fraction: number; readonly pct: number }
  | {
      readonly ok: false;
      readonly reason: 'nan' | 'negative' | 'below_min' | 'above_max' | 'too_precise';
      readonly message: string;
    };

/** Arredonda para `TIER_DISCOUNT_DECIMALS` casas, evitando ruído de float (ex.: 7.0000000001). */
function roundPct(pct: number): number {
  const f = 10 ** TIER_DISCOUNT_DECIMALS;
  return Math.round(pct * f) / f;
}

/**
 * Valida um percentual humano (0–100) de desconto por tier contra os limites da tabela.
 * NÃO aceita 0 como válido aqui: 0 significa "sem desconto por tier" e é tratado fora desta função
 * (ver `resolveTierDiscount`). Esta função valida um desconto EFETIVAMENTE pedido.
 */
export function validateTierDiscountPct(pctInput: unknown, limits: TierDiscountLimits): TierDiscountValidation {
  // Aceita number ou string numérica; qualquer outra coisa é NaN.
  const raw = typeof pctInput === 'number' ? pctInput : typeof pctInput === 'string' ? Number(pctInput.replace(',', '.')) : NaN;
  if (!Number.isFinite(raw)) {
    return { ok: false, reason: 'nan', message: 'Valor inválido: informe um número.' };
  }
  if (raw < 0) {
    return { ok: false, reason: 'negative', message: 'Desconto não pode ser negativo.' };
  }
  const pct = roundPct(raw);
  // rejeita precisão além de duas casas (ex.: 5,005%)
  if (Math.abs(pct - raw) > 1e-9) {
    return { ok: false, reason: 'too_precise', message: `Use no máximo ${TIER_DISCOUNT_DECIMALS} casas decimais.` };
  }
  const minPct = roundPct(limits.min * 100);
  const maxPct = roundPct(limits.max * 100);
  if (pct < minPct) {
    return { ok: false, reason: 'below_min', message: `Mínimo ${minPct.toFixed(TIER_DISCOUNT_DECIMALS)}%.` };
  }
  if (pct > maxPct) {
    return { ok: false, reason: 'above_max', message: `Máximo ${maxPct.toFixed(TIER_DISCOUNT_DECIMALS)}%.` };
  }
  return { ok: true, pct, fraction: pct / 100 };
}

/**
 * Resolve o desconto por tier a aplicar no cálculo a partir de uma entrada em FRAÇÃO [0,1].
 * Política de robustez do contrato público (§21): o engine é a fronteira para CRM/portal, então
 * uma entrada ausente, 0, não-finita ou negativa vira "sem desconto" (fração 0) em vez de lançar.
 * Um valor dentro de (0, min) ou acima de max é CLAMPADO ao limite e sinalizado — nunca aplica um
 * percentual fora da faixa. A UI valida ANTES com `validateTierDiscountPct`; este clamp é o cinto
 * de segurança para consumidores que não validaram.
 */
export interface ResolvedTierDiscount {
  readonly fraction: number; // fração efetivamente aplicada [0, max]
  readonly applied: boolean; // houve desconto por tier?
  readonly clamped: boolean; // o valor pedido foi ajustado para caber nos limites?
}

export function resolveTierDiscount(fractionInput: unknown, limits: TierDiscountLimits): ResolvedTierDiscount {
  const raw = typeof fractionInput === 'number' ? fractionInput : NaN;
  if (!Number.isFinite(raw) || raw <= 0) {
    return { fraction: 0, applied: false, clamped: false };
  }
  if (raw < limits.min) {
    return { fraction: limits.min, applied: true, clamped: true };
  }
  if (raw > limits.max) {
    return { fraction: limits.max, applied: true, clamped: true };
  }
  return { fraction: raw, applied: true, clamped: false };
}
