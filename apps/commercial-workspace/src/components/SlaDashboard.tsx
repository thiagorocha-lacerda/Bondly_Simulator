import { useEffect, useState } from 'react';
import { Panel } from './Fields';
import type { ProposalView } from '../hooks/useProposals';
import type { SlaStateView } from '../hooks/useSla';

type Role = 'business' | 'tech' | 'admin';

/**
 * Painel de indicadores do SLA técnico (§6.6) — visão interna (P&T/admin).
 * Agrega o estado do relógio de cada proposta: aguardando/em andamento/pausadas/vencidas e o
 * percentual de pareceres concluídos dentro dos 5 dias úteis. Os dados vêm do BFF (/sla por proposta).
 *
 * Nota de escopo: agrega via N chamadas /sla (uma por proposta). No volume do simulador isto é
 * trivial; se a base crescer, um endpoint de agregação dedicado seria o próximo passo.
 */
export function SlaDashboard({ proposals, role, enabled }: { proposals: readonly ProposalView[]; role: Role; enabled: boolean }) {
  const [states, setStates] = useState<Record<string, SlaStateView>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!enabled || proposals.length === 0) {
      setLoaded(true);
      return;
    }
    (async () => {
      const entries = await Promise.all(
        proposals.map(async (p) => {
          try {
            const r = await fetch(`/api/proposals/${p.id}/sla`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
            if (!r.ok) return null;
            const data = (await r.json()) as { sla?: SlaStateView };
            return data.sla ? ([p.id, data.sla] as const) : null;
          } catch {
            return null;
          }
        }),
      );
      if (!alive) return;
      const map: Record<string, SlaStateView> = {};
      for (const e of entries) if (e) map[e[0]] = e[1];
      setStates(map);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [proposals, enabled]);

  if (role !== 'tech' && role !== 'admin') return null;
  if (!enabled) return null;

  const all = Object.values(states);
  const running = all.filter((s) => s.phase === 'em_andamento');
  const paused = all.filter((s) => s.phase === 'pausado');
  const overdue = all.filter((s) => s.health === 'vencido');
  const completed = all.filter((s) => s.phase === 'concluido');
  const completedOnTime = completed.filter((s) => s.metSla === true);
  const pctOnTime = completed.length > 0 ? Math.round((completedOnTime.length / completed.length) * 100) : null;

  const Metric = ({ label, value, cls }: { label: string; value: string | number; cls?: string }) => (
    <div style={{ flex: '1 1 120px', padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
      <div className={`status ${cls ?? 'info'}`} style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
      <div className="sub" style={{ margin: 0 }}>{label}</div>
    </div>
  );

  return (
    <Panel title="Indicadores de SLA técnico (§6.6)" sub="Visão interna P&T — tempo técnico efetivo (exclui pausas justificadas).">
      {!loaded && <p className="sub">Carregando indicadores…</p>}
      {loaded && all.length === 0 && <p className="sub">Nenhuma proposta com SLA iniciado ainda.</p>}
      {loaded && all.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Metric label="Em análise" value={running.length} cls="info" />
          <Metric label="Pausadas" value={paused.length} cls="info" />
          <Metric label="Vencidas" value={overdue.length} cls={overdue.length > 0 ? 'bad' : 'ok'} />
          <Metric label="Concluídas" value={completed.length} cls="ok" />
          <Metric label="% no prazo" value={pctOnTime === null ? '—' : `${pctOnTime}%`} cls={pctOnTime !== null && pctOnTime < 80 ? 'warn' : 'ok'} />
        </div>
      )}
    </Panel>
  );
}
