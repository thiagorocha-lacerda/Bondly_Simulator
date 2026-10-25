import type { PricingInput, CampaignObjective } from '@bondly/pricing-engine';
import { campaign as computeCampaign, CURRENT_PREMISES } from '@bondly/pricing-engine';
import { Panel, NumberField, PercentField, Toggle } from './Fields';
import type { InputPatch } from '../services/patch';
import { brl, pct, n0 } from '../services/defaults';

const OBJECTIVES: readonly CampaignObjective[] = ['Aquisição', 'Ativação', 'Conversão', 'Engajamento'];

/** Campanha de marketing (§14): serviço à parte, fora do ARR. Funil calculado pelo motor (`campaign()`). */
export function CampaignPanel(props: { input: PricingInput; update: (patch: InputPatch) => void }) {
  const { input, update } = props;
  const c = input.campaign;

  const toggleObjective = (o: CampaignObjective) => {
    const next = c.objectives.includes(o) ? c.objectives.filter((x) => x !== o) : [...c.objectives, o];
    update({ campaign: { objectives: next } });
  };

  const r = computeCampaign({
    params: c,
    eligibleUsers: input.volume.users,
    term: input.negotiation.term,
    tariffs: CURRENT_PREMISES.communicationTariffs.value,
    taxRate: CURRENT_PREMISES.taxRate.value,
    hourlyRate: CURRENT_PREMISES.hourlyRate.value,
  });

  return (
    <Panel title="Campanhas de marketing" sub="Markup de 20% sobre a mídia, sem vínculo com o volume de recompensas e fora do ARR.">
      <Toggle label="Contratar campanha?" value={c.enabled ? 1 : 0} options={[{ v: 0, label: 'Não' }, { v: 1, label: 'Sim' }]} onChange={(v) => update({ campaign: { enabled: v === 1 } })} />

      {c.enabled && (
        <>
          <div className="field full">
            <label>Objetivos<small>Descrevem a finalidade; o custo vem só dos volumes por canal.</small></label>
            <div className="toggle">
              {OBJECTIVES.map((o) => (
                <button key={o} type="button" aria-pressed={c.objectives.includes(o)} onClick={() => toggleObjective(o)}>{o}</button>
              ))}
            </div>
          </div>
          <NumberField label="Base de contatos (vazio = elegíveis)" value={c.base ?? 0} min={0} step={1000} onChange={(v) => update({ campaign: { base: v > 0 ? v : undefined } })} />
          <PercentField label="% da base com consentimento (LGPD)" value={c.consentPct} step={5} onChange={(v) => update({ campaign: { consentPct: v } })} />
          <NumberField label="Disparos por contato/mês" value={c.frequency} min={0} step={0.5} onChange={(v) => update({ campaign: { frequency: v } })} />
          <NumberField label="Meses de campanha" value={c.months} min={1} max={36} onChange={(v) => update({ campaign: { months: v } })} />
          <PercentField label="Mix — RCS" value={c.mix.rcs} step={5} onChange={(v) => update({ campaign: { mix: { rcs: v } } })} />
          <PercentField label="Mix — WhatsApp" value={c.mix.wa} step={5} onChange={(v) => update({ campaign: { mix: { wa: v } } })} />
          <PercentField label="Mix — SMS" value={c.mix.sms} step={5} onChange={(v) => update({ campaign: { mix: { sms: v } } })} />
          <PercentField label="Mix — E-mail" value={c.mix.email} step={5} onChange={(v) => update({ campaign: { mix: { email: v } } })} />
          <PercentField label="Taxa de conversão (hipótese)" value={c.conversionRate} step={0.5} onChange={(v) => update({ campaign: { conversionRate: v } })} />
          <PercentField label="Taxa de ativação (hipótese)" value={c.activationRate} step={1} onChange={(v) => update({ campaign: { activationRate: v } })} />
          <NumberField label="Horas de operação/mês" value={c.operationHours} min={0} onChange={(v) => update({ campaign: { operationHours: v } })} />

          <h3 style={{ marginTop: 16 }}>Funil e economia</h3>
          <table className="bd">
            <tbody>
              <tr><td>Contatos habilitados<span className="why">{pct(r.consent)} da base</span></td><td className="num">{n0(r.habilitated)}</td></tr>
              <tr><td>Enviadas → entregues<span className="why">entrega {pct(r.deliveryRate)} · {brl(r.costPerDelivered)}/entregue</span></td><td className="num">{n0(r.sends)} → {n0(r.delivered)}</td></tr>
              <tr><td>Convertidos → ativados<span className="why">CAC {brl(r.cac)} · {brl(r.costPerActivated)}/ativado</span></td><td className="num">{n0(r.acquired)} → {n0(r.activated)}</td></tr>
              <tr><td>Custo de mídia</td><td className="num">− {brl(r.media)}</td></tr>
              <tr><td>Preço de venda<span className="why">markup {pct(r.markupBreakeven >= 0 ? 0.2 : 0.2)} · margem bruta {pct(r.grossPct)}</span></td><td className="num">{brl(r.price)}</td></tr>
              <tr className="sum"><td>Contribuição da campanha<span className="why">fora do ARR e da margem técnica</span></td><td className="num">{brl(r.contribution)} · {pct(r.margin)}</td></tr>
            </tbody>
          </table>
          {r.consent === 0 && <div className="note bad">Informe a parcela da base com consentimento: sem isso a campanha não tem volume e não pode ser proposta.</div>}
        </>
      )}
    </Panel>
  );
}
