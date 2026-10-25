import { useEffect, useRef, useState } from 'react';
import type { PricingInput, B2cInput } from '@bondly/pricing-engine';
import { createProposalSnapshot, formatProposalId } from '@bondly/pricing-engine';
import { generateProposalPdf } from '../services/pdf';
import { brl } from '../services/defaults';
import { useAudience } from '../app/audience';

const SEQ_KEY = 'bondly-proposal-seq';

/** Próximo número da sequência SEM persistir (só leitura). Consumir via commitSequence após sucesso. */
function peekNextSequence(): number {
  try {
    return Number(localStorage.getItem(SEQ_KEY) ?? '0') + 1;
  } catch {
    return Math.floor(Math.random() * 999999) + 1;
  }
}

/** Persiste o número consumido — chamado SÓ após o PDF gerar com sucesso, para não queimar IDs. */
function commitSequence(n: number): void {
  try {
    localStorage.setItem(SEQ_KEY, String(n));
  } catch {
    /* ignore */
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
  const [error, setError] = useState<string | null>(null);
  const r = preview.result;
  const hasClient = !!preview.input.arka?.clientName?.trim();

  // Acessibilidade: ao fechar o modal, devolve o foco ao elemento que o abriu (evita armadilha
  // de teclado) e permite fechar com Esc. O foco inicial vai ao diálogo.
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const download = async () => {
    setBusy(true);
    setError(null);
    // Gera o PDF ANTES de consumir a sequência: se a geração falhar, nenhum identificador é
    // queimado (o próximo clique reusa o mesmo número). Só persiste o contador no sucesso.
    try {
      const n = peekNextSequence();
      const id = formatProposalId(n);
      const snap = createProposalSnapshot({
        id,
        input: props.input,
        ...(props.b2cInput ? { b2cInput: props.b2cInput } : {}),
      });
      const doc = await generateProposalPdf(snap);
      doc.save(`${snap.id}.pdf`);
      commitSequence(n); // consome o número só agora, após sucesso
      setIssuedId(id);
    } catch (e) {
      setError(
        e instanceof Error
          ? `Não foi possível gerar o PDF: ${e.message}. Nenhum identificador foi consumido — tente novamente.`
          : 'Não foi possível gerar o PDF. Nenhum identificador foi consumido — tente novamente.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pdfmodal-backdrop" role="dialog" aria-modal="true" aria-label="Pré-visualização da proposta" onClick={props.onClose}>
      <div className="pdfmodal" ref={dialogRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
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

        {!hasClient && (
          <div className="note" role="alert" style={{ marginTop: 12 }}>
            Sem cliente nomeado — a proposta sairá sem identificação do cliente. Preencha o campo
            “Cliente” se for enviá-la externamente.
          </div>
        )}
        {issuedId && !error && (
          <div className="note ok" role="status" aria-live="polite" style={{ marginTop: 12 }}>
            PDF gerado: <b>{issuedId}</b>. Verifique os downloads do navegador.
          </div>
        )}
        {error && (
          <div className="note bad" role="alert" style={{ marginTop: 12 }}>{error}</div>
        )}

        <label className="field full" style={{ cursor: 'pointer', marginTop: 12 }}>
          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="checkbox" checked={confirmed} style={{ width: 'auto' }} onChange={(e) => setConfirmed(e.target.checked)} />
            <b>Conferi os valores e confirmo a geração do PDF.</b>
          </span>
        </label>

        <div className="actions">
          <button className="cta" type="button" disabled={!confirmed || busy} onClick={() => void download()} style={{ opacity: confirmed && !busy ? 1 : 0.5 }}>
            {busy ? 'Gerando…' : issuedId && !error ? 'Gerar novamente' : 'Gerar PDF'}
          </button>
          <button className="ghostbtn" type="button" onClick={props.onClose}>
            {issuedId && !error ? 'Fechar' : 'Cancelar'}
          </button>
        </div>
        <p className="sub" style={{ marginTop: 10 }}>
          Este snapshot é imutável: alterar a proposta depois de confirmar gera uma nova revisão.
        </p>
      </div>
    </div>
  );
}
