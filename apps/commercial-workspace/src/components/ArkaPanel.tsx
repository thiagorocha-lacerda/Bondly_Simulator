import { useMemo } from 'react';
import type { PricingInput } from '@bondly/pricing-engine';
import { arkaClassification } from '@bondly/pricing-engine';

/**
 * Classificação ARKA (H1/H2/H3) — §18. Consome `arkaClassification()` do engine (nenhuma lógica
 * de evidência é reimplementada aqui). Mostra a classe, o estágio de evidência e o checklist de
 * elegibilidade ao Orçamento Compromissado.
 */
export function ArkaPanel(props: { input: PricingInput }) {
  const arka = useMemo(() => arkaClassification(props.input.arka), [props.input.arka]);
  const cls = arka.arkaClass;
  const statusClass = cls === 'H3' ? 'warn' : 'ok';

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h2>Evidência comercial — ARKA</h2>
      <p className="sub">{arka.classLabel}</p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <span className={`status ${statusClass}`}>{cls}</span>
        <span className="status info">Estágio {arka.stage.rank}/15 · {arka.stage.maturity}</span>
        <span className="status info">Pipeline: {arka.stage.pipeline}</span>
      </div>

      <table className="bd">
        <tbody>
          {arka.checks.map((c, i) => (
            <tr key={i}>
              <td>{c.label}</td>
              <td className="num">
                <span className={`status ${c.ok ? 'ok' : 'bad'}`}>{c.ok ? '✓' : '—'}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="sub" style={{ marginTop: 12 }}>{arka.note}</p>
    </div>
  );
}
