import { useMemo } from 'react';
import { runB2c, CURRENT_PREMISES, type B2cInput, type AntifraudMethod, type B2cScope } from '@bondly/pricing-engine';
import { Panel, NumberField, PercentField, Toggle } from './Fields';
import { brl, pct, n0 } from '../services/defaults';

const B2C_MONTHS = ['jul/27', 'ago/27', 'set/27', 'out/27', 'nov/27', 'dez/27'];

/** Assinaturas B2C (§7.5) — módulo H3 candidato. Estado vem do hook useB2c (fonte única); projeção via `runB2c`. */
export function B2cPanel(props: {
  input: B2cInput;
  include: boolean;
  set: (patch: Partial<B2cInput>) => void;
  setInclude: (on: boolean) => void;
}) {
  const { input, set } = props;
  const result = useMemo(() => runB2c(input, CURRENT_PREMISES), [input]);
  const t = result.tot;
  const cls = (v: number): string => (v < -0.005 ? 'bad' : v > 0.005 ? 'ok' : 'info');

  return (
    <Panel title="Assinaturas B2C — módulo H3 candidato (jul–dez/2027)" sub="A Bondly recebe o fee de processamento, paga gateway, antifraude e impostos, e divide a margem positiva com a Minu.">
      <Toggle
        label="Incluir na proposta (snapshot e PDF)"
        hint="Quando ligado, o funil B2C é congelado no snapshot da proposta e aparece no PDF."
        value={props.include ? 1 : 0}
        options={[{ v: 1, label: 'Sim' }, { v: 0, label: 'Não' }]}
        onChange={(v) => props.setInclude(v === 1)}
      />
      <Toggle label="Fee de processamento" value={input.fee} options={[{ v: 0.1, label: '10% · oficial' }, { v: 0.125, label: '12,5%' }, { v: 0.15, label: '15%' }]} onChange={(v) => set({ fee: v })} />
      <NumberField label="Base elegível (SOM)" value={input.som} min={0} step={1000} onChange={(v) => set({ som: v })} />
      <PercentField label="Meta de conversão em dez" value={input.conv} step={0.1} onChange={(v) => set({ conv: v })} />
      <NumberField label="Ticket médio mensal (R$)" value={input.ticket} min={0} step={0.5} onChange={(v) => set({ ticket: v })} />
      <PercentField label="Churn mensal" value={input.churn} step={0.5} onChange={(v) => set({ churn: v })} />
      <NumberField label="Fee mínimo por transação (R$)" value={input.minFee} min={0} step={0.1} onChange={(v) => set({ minFee: v })} />
      <PercentField label="Gateway (% do transacionado)" value={input.gateway} step={0.5} onChange={(v) => set({ gateway: v })} />
      <PercentField label="Tributos sobre o fee" value={input.tax} step={0.5} onChange={(v) => set({ tax: v })} />
      <PercentField label="Participação da Minu na margem positiva" value={input.minuShare} step={1} onChange={(v) => set({ minuShare: v })} />
      <Toggle label="Antifraude — método" value={input.method} options={[{ v: 'progressiva', label: 'Progressiva · aprovada' }, { v: 'integral', label: 'Integral' }]} onChange={(v) => set({ method: v as AntifraudMethod })} />
      <Toggle label="Antifraude — escopo" value={input.scope} options={[{ v: 'primeira', label: '1ª cobrança + troca' }, { v: 'todas', label: 'Todas as cobranças' }]} onChange={(v) => set({ scope: v as B2cScope })} />

      <h3 style={{ marginTop: 16 }}>Resultado H2/2027</h3>
      <div className="big">
        <div><b className="num">{n0(t.end)}</b><span>Assinantes ativos em dez</span></div>
        <div><b className="num">{brl(t.gmv)}</b><span>Valor transacionado H2</span></div>
        <div><b className="num">{brl(t.rev)}</b><span>Receita de processamento</span></div>
        <div className="minu"><b className="num">{brl(t.total)}</b><span>Resultado Bondly</span></div>
      </div>
      <div className={`note ${cls(t.total)}`}>
        {t.total < 0
          ? `Com fee de ${pct(input.fee)}, a receita não cobre gateway, antifraude e impostos no semestre: a Bondly fica com ${brl(t.total)}.`
          : `Margem positiva no semestre: a Bondly fica com ${brl(t.total)} (Minu ${brl(t.minu)}).`}
      </div>

      <h3 style={{ marginTop: 16 }}>Projeção mensal</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="bd" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <td style={{ fontWeight: 700 }}>Mês</td>
              {B2C_MONTHS.map((m) => (<td key={m} style={{ textAlign: 'right', fontWeight: 700 }}>{m}</td>))}
            </tr>
          </thead>
          <tbody>
            <tr><td>Ativos no fim</td>{result.rows.map((row, i) => (<td key={i} className="num">{n0(row.end)}</td>))}</tr>
            <tr><td>Receita</td>{result.rows.map((row, i) => (<td key={i} className="num">{brl(row.rev)}</td>))}</tr>
            <tr><td>Resultado Bondly</td>{result.rows.map((row, i) => (<td key={i} className="num">{brl(row.total)}</td>))}</tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
