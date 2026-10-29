import { useMemo, useState } from 'react';
import {
  CURRENT_PREMISES,
  tierFor,
  platformFeeTable,
  validateTierDiscountPct,
  TIER_DISCOUNT_DECIMALS,
  type PricingInput,
  type PricingResult,
} from '@bondly/pricing-engine';
import { Panel } from './Fields';
import { brl } from '../services/defaults';
import type { InputPatch } from '../services/patch';

const LIMITS = CURRENT_PREMISES.tierDiscountLimits.value;
const MIN_PCT = LIMITS.min * 100;
const MAX_PCT = LIMITS.max * 100;

/**
 * "Descontos por tier" (§3.1). Exibe a tabela de tiers reais do Pricing Engine, permite editar o
 * desconto (3%–7%) do TIER ATIVO (o selecionado pela base de usuários), valida inline com a MESMA
 * regra do engine (validateTierDiscountPct) e recalcula imediatamente. Tiers não aplicáveis ao
 * cenário atual são marcados como tais — nenhum desconto é aplicado artificialmente (§3.1).
 *
 * O valor editado é salvo na proposta via negotiation.tierDiscount (fração) — não altera a tabela
 * global. "Restaurar padrão" zera o desconto por tier (volta à política sem desconto por tier).
 */
export function TierDiscountPanel(props: {
  input: PricingInput;
  result: PricingResult;
  update: (patch: InputPatch) => void;
}) {
  const { input, result, update } = props;
  const tiers = CURRENT_PREMISES.tiers.value;
  const activeTier = tierFor(input.volume.users, tiers);

  // percentual humano atual (fração → p.p.), arredondado às casas aceitas
  const currentPct = useMemo(() => {
    const f = input.negotiation.tierDiscount ?? 0;
    return Math.round(f * 100 * 10 ** TIER_DISCOUNT_DECIMALS) / 10 ** TIER_DISCOUNT_DECIMALS;
  }, [input.negotiation.tierDiscount]);

  const [draft, setDraft] = useState<string>(currentPct > 0 ? String(currentPct) : '');

  const validation = draft.trim() === '' ? null : validateTierDiscountPct(draft, LIMITS);
  const error = validation && !validation.ok ? validation.message : null;

  function commit(value: string) {
    setDraft(value);
    if (value.trim() === '') {
      update({ negotiation: { tierDiscount: 0 } });
      return;
    }
    const v = validateTierDiscountPct(value, LIMITS);
    if (v.ok) update({ negotiation: { tierDiscount: v.fraction } });
    // inválido: não propaga ao engine; mantém o último válido e mostra o erro inline
  }

  function restoreDefault() {
    if (!window.confirm('Restaurar o desconto por tier para o padrão (sem desconto por tier)?')) return;
    setDraft('');
    update({ negotiation: { tierDiscount: 0 } });
  }

  const applied = result.tierDiscountApplied;
  const w = result.discountWaterfall;

  return (
    <Panel
      title="Descontos por tier"
      sub={`Desconto editável por tier, de ${MIN_PCT.toFixed(2)}% a ${MAX_PCT.toFixed(2)}%. Incide só sobre o Platform Fee, antes do desconto negociado e do prazo. Política pendente de aprovação comercial.`}
    >
      <div className="field full">
        <label htmlFor="tier-discount-input">
          Desconto do tier ativo — <b>{activeTier.name}</b>
          <small>Salvo na proposta; não altera a tabela global. Faixa {MIN_PCT.toFixed(2)}%–{MAX_PCT.toFixed(2)}%, duas casas decimais.</small>
        </label>
        <div className="inputwrap">
          <input
            id="tier-discount-input"
            type="number"
            inputMode="decimal"
            value={draft}
            min={0}
            max={MAX_PCT}
            step={0.01}
            placeholder="0,00"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'tier-discount-error' : undefined}
            onChange={(e) => commit(e.target.value)}
          />
          <span className="unit" aria-hidden="true">%</span>
        </div>
        {error && (
          <small id="tier-discount-error" role="alert" style={{ color: 'var(--error)' }}>
            {error}
          </small>
        )}
      </div>

      <div className="field full" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="button" className="ghostbtn" onClick={restoreDefault}>
          Restaurar valores padrão
        </button>
        <span className="sub" style={{ margin: 0 }}>
          {applied ? `Aplicado: ${(result.tierDiscount * 100).toFixed(2)}% sobre o Platform Fee` : 'Nenhum desconto por tier aplicado'}
        </span>
      </div>

      <div className="field full">
        <table className="bd" aria-label="Descontos por tier">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Tier</th>
              <th style={{ textAlign: 'left' }}>Faixa (usuários)</th>
              <th style={{ textAlign: 'right' }}>Preço-base PF</th>
              <th style={{ textAlign: 'right' }}>Desconto</th>
              <th style={{ textAlign: 'right' }}>PF após desconto</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => {
              const isActive = t.name === activeTier.name;
              const basePf = platformFeeTable(t.users, CURRENT_PREMISES.platformFeeBands.value);
              const disc = isActive ? result.tierDiscount : 0;
              const after = basePf * (1 - disc);
              return (
                <tr key={t.name} className={isActive ? 'sum' : undefined}>
                  <td>
                    {t.name}
                    {isActive && <span className="why">tier ativo</span>}
                  </td>
                  <td>{'até ' + t.users.toLocaleString('pt-BR')}</td>
                  <td className="num">{brl(basePf)}</td>
                  <td className="num">
                    {isActive ? (disc > 0 ? `${(disc * 100).toFixed(2)}%` : '—') : <span className="sub" style={{ margin: 0 }}>n/a</span>}
                  </td>
                  <td className="num">{isActive ? brl(after) : <span className="sub" style={{ margin: 0 }}>—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <small className="sub">
          Só o tier ativo (selecionado pela base de usuários) recebe desconto neste cenário; os demais
          são exibidos como referência e marcados como não aplicáveis (§3.1).
        </small>
      </div>

      {applied && (
        <div className="field full">
          <h3 style={{ marginBottom: 6 }}>Waterfall do Platform Fee</h3>
          <table className="bd" aria-label="Composição do desconto">
            <tbody>
              <tr>
                <td>Platform Fee escolhido (base)</td>
                <td className="num">{brl(w.base)}</td>
              </tr>
              <tr>
                <td>− Desconto por tier<span className="why">{(w.tierDiscountRate * 100).toFixed(2)}%</span></td>
                <td className="num">{brl(w.afterTierDiscount)}</td>
              </tr>
              {w.commercialDiscountRate > 0 && (
                <tr>
                  <td>− Desconto negociado<span className="why">{(w.commercialDiscountRate * 100).toFixed(2)}%</span></td>
                  <td className="num">{brl(w.afterCommercialDiscount)}</td>
                </tr>
              )}
              {w.termDiscountRate > 0 && (
                <tr>
                  <td>− Desconto por prazo<span className="why">{(w.termDiscountRate * 100).toFixed(2)}%</span></td>
                  <td className="num">{brl(w.final)}</td>
                </tr>
              )}
              <tr className="sum">
                <td>Platform Fee final</td>
                <td className="num">{brl(w.final)}/mês</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
