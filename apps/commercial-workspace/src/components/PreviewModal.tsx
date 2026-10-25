import { useState } from 'react';
import type { PricingInput, B2cInput } from '@bondly/pricing-engine';
import { createProposalSnapshot, formatProposalId } from '@bondly/pricing-engine';
import { generateProposalPdf } from '../services/pdf';
import { brl } from '../services/defaults';
import { useAudience } from '../app/audience';

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
 * A pré-visualização usa um snapshot PROVISÓRIO (sem consumir a sequência de identificadores).
 * A sequência `BONDLY-2027-NNNNNN` só é consumida ao GERAR o PDF — abrir/cancelar não queima IDs (§15).
 */
export function PreviewModal(props: {
  input: PricingInput;
  b2cInput?: B2cInput | undefined;
  onClose: () => void;
}) {
  const { internal } = useAudience();
  // Snapshot provisório só para exibir os números na conferência. ID real é atribuído ao gerar.
  const [preview] = useState(() =>
    createProposalSnapshot({
      id: formatProposalId(0),
      input: props.input,
      ...(props.b2cInput ? { b2cInput: props.b2cInput } : {}),
    }),
  );
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issuedId, setIssuedId] = useState<string | null>(null);
  const r = preview.result;

  const download = async () => {
    setBusy(true);
    try {
      // Consome a sequência AGORA (não na abertura) e congela o snapshot definitivo com o ID real.
      const id = formatProposalId(nextSequence());
      setIssuedId(id);
      const snap = createProposalSnapshot({
        id,
        input: props.input,
        ...(props.b2cInput ? { b2cInput: props.b2cInput } : {}),
      });
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
          Identificador <b>{issuedId ?? 'definido ao gerar o PDF'}</b> · motor {r.engineVersion} · premissas {r.premisesVersion} ({r.premisesHash})
        </p>
        <table className="bd">
          <tbody>
            <tr><td>Cliente</td><td className="num">{preview.input.arka?.clientName || '—'}</td></tr>
            <tr><td>Tier · usuários</td><td className="num">{r.tierName} · {preview.input.volume.users.toLocaleString('pt-BR')}</td></tr>
            <tr><td>Prazo</td><td className="num">{preview.input.negotiation.term} meses</td></tr>
            <tr className="sum"><td>Setup</td><td className="num">{brl(r.setupClient)}</td></tr>
            <tr><td>Valor mensal estimado</td><td className="num">{brl(r.core + r.servicesMrr)}/mês</td></tr>
            <tr className="sum"><td>TCV ao cliente</td><td className="num">{brl(r.tcvClient)}</td></tr>
            {preview.b2c && (
              internal ? (
                <tr><td>Assinaturas B2C · resultado Bondly H2</td><td className="num">{brl(preview.b2c.result.tot.total)}</td></tr>
              ) : (
                // Visão comercial: NÃO expõe o resultado Bondly (número interno). Só volume ao cliente.
                <tr><td>Assinaturas B2C · ativos em dez</td><td className="num">{preview.b2c.result.tot.end.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td></tr>
              )
            )}
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
