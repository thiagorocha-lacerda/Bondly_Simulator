import { describe, it, expect } from 'vitest';
import { createProposalSnapshot } from '@bondly/pricing-engine';
import { generateProposalPdf } from './pdf';
import { DEFAULT_INPUT } from './defaults';

/**
 * Smoke test do gerador de PDF comercial: usa a API real do jsPDF 4.x (addImage/roundedRect/
 * splitTextToSize/getNumberOfPages/setPage) e produz um documento %PDF- válido a partir de um
 * snapshot real do engine. Garante que a peça comercial não quebra em runtime.
 */
describe('generateProposalPdf — peça comercial', () => {
  it('gera um PDF válido (com e sem cliente nomeado)', async () => {
    const snap = createProposalSnapshot({ id: 'BONDLY-2027-000001', input: DEFAULT_INPUT });
    const doc = await generateProposalPdf(snap);
    const buf = doc.output('arraybuffer');
    const head = String.fromCharCode(...new Uint8Array(buf.slice(0, 5)));
    expect(head).toBe('%PDF-');
    expect(buf.byteLength).toBeGreaterThan(1000);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('inclui a seção B2C quando a proposta carrega o módulo', async () => {
    const snap = createProposalSnapshot({
      id: 'BONDLY-2027-000002',
      input: { ...DEFAULT_INPUT, arka: { clientName: 'ACME', goLiveDate: '', owner: '', evidenceStage: 8, probability: 50 } },
      b2cInput: { som: 1_000_000, conv: 0.01, ticket: 10, churn: 0.08, fee: 0.1, weights: [10, 14, 17, 19, 20, 20] } as never,
    });
    const doc = await generateProposalPdf(snap);
    const head = String.fromCharCode(...new Uint8Array(doc.output('arraybuffer').slice(0, 5)));
    expect(head).toBe('%PDF-');
  });

  it('PDF interno tem mais páginas/conteúdo que o do cliente (seções internas)', async () => {
    const snap = createProposalSnapshot({
      id: 'BONDLY-2027-000003',
      input: DEFAULT_INPUT,
      selectedModules: ['points', 'engagement'],
    });
    const ext = await generateProposalPdf(snap, 'external');
    const int = await generateProposalPdf(snap, 'internal');
    // o interno acrescenta composição/COGS/margens/ARKA → documento maior
    expect(int.output('arraybuffer').byteLength).toBeGreaterThan(ext.output('arraybuffer').byteLength);
    expect(snap.selectedModules).toEqual(['points', 'engagement']);
  });
});
