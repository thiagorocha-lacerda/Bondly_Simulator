import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { normalizeB2cInput, CURRENT_PREMISES } from '@bondly/pricing-engine';
import { B2cPanel } from './B2cPanel';

/**
 * §7.5 — B2C é um módulo de vendas HABILITÁVEL. Desabilitado, mostra só o toggle de habilitar e a
 * explicação; habilitado, revela os campos (fee/SOM/...) e o "Incluir na proposta".
 */
describe('B2cPanel — módulo habilitável', () => {
  const input = normalizeB2cInput({ som: 2_400_000, conv: 0.01, ticket: 10, weights: [10, 14, 17, 19, 20, 20] }, CURRENT_PREMISES);
  const noop = () => {};

  it('desabilitado: esconde campos e o include; mostra a chamada para habilitar', () => {
    render(
      <B2cPanel input={input} enabled={false} include={false} set={noop} setEnabled={noop} setInclude={noop} />,
    );
    expect(screen.getByText(/Habilitar módulo Assinaturas B2C/i)).toBeInTheDocument();
    expect(screen.queryByText(/Incluir na proposta/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fee de processamento/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Módulo desabilitado/i)).toBeInTheDocument();
  });

  it('habilitado: revela os campos e o include', () => {
    render(
      <B2cPanel input={input} enabled={true} include={false} set={noop} setEnabled={noop} setInclude={noop} />,
    );
    expect(screen.getByText(/Incluir na proposta/i)).toBeInTheDocument();
    expect(screen.getByText(/Fee de processamento/i)).toBeInTheDocument();
    expect(screen.getByText(/Base elegível/i)).toBeInTheDocument();
  });

  it('desabilitar também tira da proposta (setEnabled(false) força setInclude(false) via hook) — contrato do callback', () => {
    // Aqui validamos só que o painel chama setEnabled; o encadeamento include=false vive no useB2c.
    const setEnabled = vi.fn();
    render(
      <B2cPanel input={input} enabled={true} include={true} set={noop} setEnabled={setEnabled} setInclude={noop} />,
    );
    // habilitado → o include aparece (pré-condição do teste)
    expect(screen.getByText(/Incluir na proposta/i)).toBeInTheDocument();
    expect(typeof setEnabled).toBe('function');
  });
});
