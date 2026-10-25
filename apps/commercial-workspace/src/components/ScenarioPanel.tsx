import { useMemo } from 'react';
import type { PricingInput } from '@bondly/pricing-engine';
import { defaultScenarios } from '@bondly/pricing-engine';
import { brl, pct } from '../services/defaults';

/**
 * Comparação de cenários (§13): conservador (−30% MAU) / base / otimista (+30% MAU).
 * Usa `defaultScenarios()` do engine — o MESMO motor recalcula cada cenário, sem fórmula paralela.
 */
export function ScenarioPanel(props: { input: PricingInput }) {
  const scenarios = useMemo(() => defaultScenarios(props.input), [props.input]);
  const label: Record<string, string> = {
    conservador: 'Conservador · −30% MAU',
    base: 'Base',
    otimista: 'Otimista · +30% MAU',
  };

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h2>Cenários — sensibilidade ao engajamento</h2>
      <p className="sub">Mesmas premissas e motor; varia só o MAU. Útil para enquadrar o risco da proposta.</p>
      <table className="bd">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Cenário</th>
            <th className="num">Core MRR</th>
            <th className="num">TCV ao cliente</th>
            <th className="num">Margem técnica</th>
            <th className="num">Status</th>
          </tr>
        </thead>
        <tbody>
          {scenarios.map((s) => (
            <tr key={s.name} className={s.name === 'base' ? 'sum' : undefined}>
              <td>{label[s.name] ?? s.name}</td>
              <td className="num">{brl(s.result.core)}/mês</td>
              <td className="num">{brl(s.result.tcvClient)}</td>
              <td className="num">{pct(s.result.technicalMargin)}</td>
              <td className="num">
                <span
                  className={`status ${
                    s.result.marginStatus === 'SAUDÁVEL'
                      ? 'ok'
                      : s.result.marginStatus === 'REVISAR'
                        ? 'warn'
                        : s.result.marginStatus === 'REPRECIFICAR'
                          ? 'bad'
                          : 'info'
                  }`}
                >
                  {s.result.marginStatus}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
