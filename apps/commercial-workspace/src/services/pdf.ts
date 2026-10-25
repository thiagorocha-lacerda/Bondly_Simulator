import type { jsPDF } from 'jspdf';
import type { ProposalSnapshot } from '@bondly/pricing-engine';
import { arkaClassification } from '@bondly/pricing-engine';
import { brl, pct } from './defaults';

/**
 * Gerador de PDF da proposta (§16). Consome EXCLUSIVAMENTE o snapshot do Pricing Engine —
 * nenhum valor é recalculado aqui (paridade Engine = Dashboard = Pré-visualização = PDF, §20).
 * Visão comercial externa: não expõe custos, margens nem fees internos (§12/§16).
 *
 * jsPDF é carregado via import() dinâmico: fica fora do bundle principal e só é baixado quando
 * o usuário gera um PDF (code-splitting, §27.1 build Render).
 */
export async function generateProposalPdf(snap: ProposalSnapshot): Promise<jsPDF> {
  const { jsPDF: JsPDF } = await import('jspdf');
  const r = snap.result;
  const doc = new JsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = 64;

  const line = (text: string, size = 11, bold = false, color = '#12131c') => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.text(text, M, y);
    y += size + 8;
  };
  const row = (k: string, v: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor('#3e4152');
    doc.text(k, M, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#12131c');
    doc.text(v, W - M, y, { align: 'right' });
    y += 20;
  };
  const rule = () => {
    doc.setDrawColor('#e1ddd0');
    doc.line(M, y, W - M, y);
    y += 16;
  };

  // Capa / cabeçalho
  doc.setFillColor('#2a2470');
  doc.rect(0, 0, W, 8, 'F');
  line('BONDLY', 22, true, '#2a2470');
  line('Proposta Comercial', 14, true);
  y += 4;
  line(`Identificador: ${snap.id}  ·  Revisão ${snap.revision}`, 10, false, '#757a90');
  line(`Emitida em ${new Date(snap.issuedAt).toLocaleString('pt-BR')}`, 10, false, '#757a90');
  rule();

  // Cliente e escopo
  line('Cliente e escopo', 13, true);
  row('Cliente', snap.input.arka?.clientName || '—');
  row('Owner comercial', snap.input.arka?.owner || '—');
  row('Go-live previsto', snap.input.arka?.goLiveDate || '—');
  row('Tier', r.tierName);
  row('Usuários elegíveis', snap.input.volume.users.toLocaleString('pt-BR'));
  row('Prazo contratual', `${snap.input.negotiation.term} meses`);
  const arka = arkaClassification(snap.input.arka);
  row('Classe ARKA', `${arka.arkaClass} · ${arka.stage.maturity} (estágio ${arka.stage.rank}/15)`);
  rule();

  // Condições comerciais (visão externa)
  line('Condições comerciais', 13, true);
  row('Setup', brl(r.setupClient));
  row('Valor mensal estimado', brl(r.core + r.servicesMrr));
  row('TCV (valor total do contrato)', brl(r.tcvClient));
  row('Cliente paga no 1º ano', brl(r.clientYear1));
  rule();

  // Composição da mensalidade (sem custos internos)
  line('Composição da mensalidade', 13, true);
  row('Platform Fee', `${brl(r.platformFee)}/mês`);
  row('DAU Usage', `${brl(r.usage)}/mês`);
  row('Processing', `${brl(r.processing)}/mês`);
  if (r.servicesMrr > 0) row('Recursos dedicados', `${brl(r.servicesMrr)}/mês`);
  if (snap.input.negotiation.term > 12) row('Condição por prazo', pct(r.termDiscount));

  // Nota: o módulo B2C NÃO entra no PDF externo. "Resultado Bondly" e o split com a Minu são
  // números internos (margem da Bondly); a proposta externa (§12/§16) não os expõe. O B2C continua
  // congelado no snapshot (reprodutibilidade/uso interno), apenas não é renderizado aqui.

  // Cenários de sensibilidade (§13) — conservador / base / otimista
  {
    const pageH = doc.internal.pageSize.getHeight();
    if (y > pageH - 160) {
      doc.addPage();
      y = 64;
    }
    y += 8;
    rule();
    line('Cenários — sensibilidade ao engajamento (±30% MAU)', 13, true);
    const labels: Record<string, string> = {
      conservador: 'Conservador (−30% MAU)',
      base: 'Base',
      otimista: 'Otimista (+30% MAU)',
    };
    // cabeçalho — visão externa: só receita (Core MRR / TCV), SEM margem técnica (interna, §12/§16)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor('#3e4152');
    doc.text('Cenário', M, y);
    doc.text('Core MRR', W - M - 150, y, { align: 'right' });
    doc.text('TCV', W - M, y, { align: 'right' });
    y += 16;
    doc.setDrawColor('#e1ddd0');
    doc.line(M, y - 6, W - M, y - 6);
    for (const s of snap.scenarios) {
      const isBase = s.name === 'base';
      doc.setFont('helvetica', isBase ? 'bold' : 'normal');
      doc.setFontSize(10);
      doc.setTextColor('#12131c');
      doc.text(labels[s.name] ?? s.name, M, y);
      doc.text(`${brl(s.result.core)}/mês`, W - M - 150, y, { align: 'right' });
      doc.text(brl(s.result.tcvClient), W - M, y, { align: 'right' });
      y += 18;
    }
  }

  // Rodapé de reprodutibilidade
  y = doc.internal.pageSize.getHeight() - 40;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor('#757a90');
  doc.text(
    `Gerado pelo Pricing Engine ${r.engineVersion} · premissas ${r.premisesVersion} (${r.premisesHash}). Valores reproduzíveis; não expõe custos ou margens internas.`,
    M,
    y,
    { maxWidth: W - 2 * M },
  );

  return doc;
}
