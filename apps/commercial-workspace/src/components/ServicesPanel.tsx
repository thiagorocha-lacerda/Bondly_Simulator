import type { PricingInput, DedicatedProfile } from '@bondly/pricing-engine';
import { services as computeServices, CURRENT_PREMISES } from '@bondly/pricing-engine';
import { Panel, NumberField, PercentField } from './Fields';
import type { InputPatch } from '../services/patch';
import { brl, pct } from '../services/defaults';

const chipClass = (s: 'g' | 'y' | 'r'): string => (s === 'g' ? 'ok' : s === 'y' ? 'warn' : 'bad');
const chipLabel = (s: 'g' | 'y' | 'r'): string =>
  s === 'g' ? 'meta atingida' : s === 'y' ? 'sustentável' : 'abaixo do mínimo';

const EMPTY: DedicatedProfile = { name: '', quantity: 0, totalCompensation: 25000, directCosts: 0 };

/** Serviços: recursos dedicados por perfil + horas (§7.2/§7.3). Resultado vem do motor (`services()`). */
export function ServicesPanel(props: { input: PricingInput; update: (patch: InputPatch) => void }) {
  const { input, update } = props;
  const profiles = input.services.profiles.length ? input.services.profiles : [{ ...EMPTY, name: 'Perfil 1' }];

  const setProfile = (i: number, patch: Partial<DedicatedProfile>) => {
    const next = profiles.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
    update({ services: { profiles: next } });
  };
  const addProfile = () => {
    update({ services: { profiles: [...profiles, { ...EMPTY, name: `Perfil ${profiles.length + 1}` }] } });
  };

  const sv = computeServices({
    params: input.services,
    taxRate: CURRENT_PREMISES.taxRate.value,
    tablePriceDefault: CURRENT_PREMISES.dedicatedTablePrice.value,
    hourlyRate: CURRENT_PREMISES.hourlyRate.value,
    implementationHours: input.complexity.implementationHours,
  });

  return (
    <Panel
      title="Serviços — recursos dedicados e horas"
      sub="Recorrente, fora do ARR Core. Quatro preços: Tabela, Mínimo Sustentável (PMS), Comercial Sugerido (PCS) e negociado."
    >
      <div className="field">
        <label>Margem mínima por profissional<small>Premissa aprovada: R$ 5.000/mês.</small></label>
        <input type="number" value={input.services.minMargin} step={100} onChange={(e) => update({ services: { minMargin: Number(e.target.value) || 0 } })} />
      </div>
      <div className="field">
        <label>Teto de Total Comp<small>Premissa aprovada: R$ 25.000/mês.</small></label>
        <input type="number" value={input.services.compCap} step={500} onChange={(e) => update({ services: { compCap: Number(e.target.value) || 0 } })} />
      </div>
      <PercentField label="Repasses sobre serviços" value={input.services.passthroughPct} step={0.5} onChange={(v) => update({ services: { passthroughPct: v } })} />

      {profiles.map((p, i) => (
        <div key={i} style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
          <div className="field full">
            <label>Perfil {i + 1}</label>
            <input type="text" value={p.name} onChange={(e) => setProfile(i, { name: e.target.value })} />
          </div>
          <NumberField label="Quantidade" value={p.quantity} min={0} onChange={(v) => setProfile(i, { quantity: v })} />
          <NumberField label="Total Comp unitário/mês" value={p.totalCompensation} step={500} onChange={(v) => setProfile(i, { totalCompensation: v })} />
          <NumberField label="Custos diretos adicionais" value={p.directCosts} step={100} onChange={(v) => setProfile(i, { directCosts: v })} />
          <NumberField label="Preço negociado (vazio = PCS)" value={p.negotiatedPrice ?? 0} step={100} onChange={(v) => setProfile(i, { negotiatedPrice: v > 0 ? v : undefined })} />
        </div>
      ))}
      <div className="actions">
        <button className="ghostbtn" type="button" onClick={addProfile}>+ Adicionar perfil</button>
      </div>

      <h3 style={{ marginTop: 16 }}>Resultado dos serviços</h3>
      <table className="bd">
        <tbody>
          {sv.profiles.filter((p) => p.quantity > 0).map((p) => (
            <tr key={p.index}>
              <td>
                {p.name} ({p.quantity})
                <span className="why">PMS {brl(p.pms)} · PCS {brl(p.pcs)} · margem {pct(p.marginPct)}</span>
              </td>
              <td className="num">
                {brl(p.price)} <span className={`status ${chipClass(p.status)}`}>{chipLabel(p.status)}</span>
              </td>
            </tr>
          ))}
          <tr className="sum">
            <td>Equipe · MRR de serviços<span className="why">{sv.team} profissional(is) · margem {brl(sv.margin)}</span></td>
            <td className="num">{brl(sv.mrr)}/mês</td>
          </tr>
          <tr>
            <td>Horas adicionais<span className="why">{sv.implementationHours} h × {brl(sv.hourPrice)} · PMS/h {brl(sv.hourPms)}</span></td>
            <td className="num">{brl(sv.implementationCost)} (Setup)</td>
          </tr>
        </tbody>
      </table>
      {sv.belowMin > 0 && (
        <div className="note bad">{sv.belowMin} perfil(is) abaixo da margem mínima: proposta economicamente inadequada.</div>
      )}
    </Panel>
  );
}
