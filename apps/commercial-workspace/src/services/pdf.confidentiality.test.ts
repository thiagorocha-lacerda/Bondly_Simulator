import { describe, it, expect, vi } from 'vitest';
import { createProposalSnapshot } from '@bondly/pricing-engine';
import { DEFAULT_INPUT } from './defaults';

/**
 * Prova de coerência de confidencialidade (§12/§16): captura TODO texto que o gerador escreve no
 * PDF (interceptando doc.text via mock do jsPDF) e verifica que a peça EXTERNA não contém termos
 * internos (COGS, margem, resultado Bondly, ARKA, hash) e que a INTERNA contém.
 */
const captured: string[] = [];
vi.mock('jspdf', () => {
  class FakeDoc {
    internal = { pageSize: { getWidth: () => 595, getHeight: () => 842 } };
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setFillColor() {}
    setDrawColor() {}
    rect() {}
    roundedRect() {}
    line() {}
    addPage() {}
    setPage() {}
    getNumberOfPages() { return 1; }
    getTextWidth() { return 10; }
    splitTextToSize(t: string) { return [t]; }
    addImage() {}
    text(t: string | string[]) { captured.push(Array.isArray(t) ? t.join(' ') : t); }
    output() { return new ArrayBuffer(8); }
    save() {}
  }
  return { jsPDF: FakeDoc };
});
vi.mock('../assets/logo', () => ({ BONDLY_LOGO_PNG: 'data:image/png;base64,AA==', BONDLY_LOGO_W: 875, BONDLY_LOGO_H: 240 }));

async function textsFor(audience: 'internal' | 'external'): Promise<string> {
  captured.length = 0;
  const { generateProposalPdf } = await import('./pdf');
  const snap = createProposalSnapshot({
    id: 'BONDLY-2027-000123',
    input: { ...DEFAULT_INPUT, arka: { clientName: 'ACME', goLiveDate: '2027-03-01', owner: 'Ana', evidenceStage: 8, probability: 60 } },
    selectedModules: ['points', 'engagement'],
    b2cInput: { som: 1_000_000, conv: 0.01, ticket: 10, churn: 0.08, fee: 0.1, weights: [10, 14, 17, 19, 20, 20] } as never,
  });
  await generateProposalPdf(snap, audience);
  return captured.join('\n');
}

describe('PDF — coerência de confidencialidade por audience', () => {
  const INTERNAL_TERMS = [/COGS|Custo variável/i, /Margem técnica/i, /Resultado Bondly/i, /ARKA/i, /Alçada/i, /premissas v/i];

  it('EXTERNA (cliente) NÃO expõe nenhum termo interno', async () => {
    const t = await textsFor('external');
    for (const re of INTERNAL_TERMS) expect(t).not.toMatch(re);
    // mas mantém o que é do cliente
    expect(t).toMatch(/Investimento mensal estimado/i);
    expect(t).toMatch(/Motor de Pontos/i);
    expect(t).toMatch(/PROPOSTA COMERCIAL/i);
  });

  it('INTERNA contém os termos internos (completa)', async () => {
    const t = await textsFor('internal');
    for (const re of INTERNAL_TERMS) expect(t).toMatch(re);
    expect(t).toMatch(/USO INTERNO/i);
  });
});
