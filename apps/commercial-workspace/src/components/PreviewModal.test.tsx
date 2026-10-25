import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { normalizeB2cInput, CURRENT_PREMISES } from '@bondly/pricing-engine';
import { PreviewModal } from './PreviewModal';
import { DEFAULT_INPUT } from '../services/defaults';

/**
 * §12/§16 — a proposta externa (visão comercial) NÃO pode expor números internos da Bondly.
 * O bloco B2C mostra o "resultado Bondly H2" (margem interna) só na visão interna; na comercial,
 * mostra apenas o volume ao cliente (assinantes ativos). Este teste trava esse contrato.
 */
describe('PreviewModal — confidencialidade por audience (§12/§16)', () => {
  const b2cInput = normalizeB2cInput(
    { som: 2_400_000, conv: 0.01, ticket: 10, churn: 0.08, fee: 0.1, weights: [10, 14, 17, 19, 20, 20] },
    CURRENT_PREMISES,
  );

  it('visão interna: expõe o resultado Bondly H2 do B2C', () => {
    render(<PreviewModal input={DEFAULT_INPUT} b2cInput={b2cInput} audience="internal" onClose={() => {}} />);
    expect(screen.getByText(/resultado Bondly H2/i)).toBeInTheDocument();
    expect(screen.queryByText(/ativos em dez/i)).not.toBeInTheDocument();
  });

  it('visão comercial: NÃO expõe o resultado Bondly; mostra só assinantes ativos', () => {
    render(<PreviewModal input={DEFAULT_INPUT} b2cInput={b2cInput} audience="external" onClose={() => {}} />);
    expect(screen.queryByText(/resultado Bondly H2/i)).not.toBeInTheDocument();
    expect(screen.getByText(/ativos em dez/i)).toBeInTheDocument();
  });

  it('sem B2C incluído: nenhuma linha B2C em qualquer visão', () => {
    const { rerender } = render(<PreviewModal input={DEFAULT_INPUT} audience="external" onClose={() => {}} />);
    expect(screen.queryByText(/Assinaturas B2C/i)).not.toBeInTheDocument();
    rerender(<PreviewModal input={DEFAULT_INPUT} audience="internal" onClose={() => {}} />);
    expect(screen.queryByText(/Assinaturas B2C/i)).not.toBeInTheDocument();
  });
});
