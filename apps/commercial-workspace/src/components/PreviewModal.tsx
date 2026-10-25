import { useState } from 'react';
import type { PricingInput } from '@bondly/pricing-engine';
import { createProposalSnapshot, formatProposalId } from '@bondly/pricing-engine';
import { generateProposalPdf } from '../services/pdf';
import { brl } from '../services/defaults';

const SEQ_KEY = 'bondly-proposal-seq';

function nextSequence(): number {
  try {
    const n = Number(localStorage.getItem(SEQ_KEY) ?? '0') + 1;
    localStorage.setItem(SEQ_KEY, String(n));
    return n;
  } catch {
    return Math.floor(Math.random() * 999999) + 1;
  }
}

/**
 * Fluxo PRÉ-VISUALIZAR → CONFERIR → CONFIRMAR → GERAR PDF (§16).
 * Ao abrir, congela um snapshot imutável; qualquer alteração posterior invalida a confirmação
 * (o modal é fechado e reaberto com um novo snapshot).
 */
export function PreviewModal(props: { input: PricingInput; onClose: () => void }) {
  const [snap] = useState(() =>
    createProposalSnapshot({ id: formatProposalId(nextSequence()), input: props.input }),
  );
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const r = snap.result;

  const download = async () => {
    setBusy(true);
    try {
      const doc = await generateProposalPdf(snap);
      doc.save(`${snap.id}.pdf`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pdfmodal-backdrop" role="dialog" aria-modal="true" aria-label="Pré-visualização da proposta" onClick={props.onClose}>
      <div className="pdfmodal" onClick={(e) => e.stopPropagation()}>
        <h2>Pré-visualizar proposta</h2>
        <p className="sub">
          Identificador <b>{snap.id}</b> · motor {r.engineVersion} · premissas {r.premisesVersion} ({r.premisesHash})
        </p>
        <table className="bd">
          <tbody>
            <tr><td>Cliente</td><td className="num">{snap.input.arka?.clientName || '—'}</td></tr>
            <tr><td>Tier · usuários</td><td className="num">{r.tierName} · {snap.input.volume.users.toLocaleString('pt-BR')}</td></tr>
            <tr><td>Prazo</td><td className="num">{snap.input.negotiation.term} meses</td></tr>
            <tr className="sum"><td>Setup</td><td className="num">{brl(r.setupClient)}</td></tr>
            <tr><td>Valor mensal estimado</td><td className="num">{brl(r.core + r.servicesMrr)}/mês</td></tr>
            <tr className="sum"><td>TCV ao cliente</td><td className="num">{brl(r.tcvClient)}</td></tr>
          </tbody>
        </table>

        <label className="field full" style={{ cursor: 'pointer', marginTop: 12 }}>
          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="checkbox" checked={confirmed} style={{ width: 'auto' }} onChange={(e) => setConfirmed(e.target.checked)} />
            <b>Conferi os valores e confirmo a geração do PDF.</b>
          </span>
        </label>

        <div className="actions">
          <button className="cta" type="button" disabled={!confirmed || busy} onClick={() => void download()} style={{ opacity: confirmed && !busy ? 1 : 0.5 }}>
            {busy ? 'Gerando…' : 'Gerar PDF'}
          </button>
          <button className="ghostbtn" type="button" onClick={props.onClose}>
            Cancelar
          </button>
        </div>
        <p className="sub" style={{ marginTop: 10 }}>
          Este snapshot é imutável: alterar a proposta depois de confirmar gera uma nova revisão.
        </p>
      </div>
    </div>
  );
}
