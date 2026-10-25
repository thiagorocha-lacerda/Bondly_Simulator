import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { normalizeB2cInput, CURRENT_PREMISES } from '@bondly/pricing-engine';
import { B2cPanel } from './B2cPanel';
import { AudienceProvider, type Audience } from '../app/audience';

/**
 * §7.5 — B2C é um módulo de vendas HABILITÁVEL. Desabilitado, mostra só o toggle de habilitar e a
 * explicação; habilitado, revela os campos (fee/SOM/...) e o "Incluir na proposta".
 * §12/§16 — em visão comercial não expõe Resultado Bondly / split Minu.
 */
describe('B2cPanel — módulo habilitável + confidencialidade', () => {
  const input = normalizeB2cInput({ som: 2_400_000, conv: 0.01, ticket: 10, weights: [10, 14, 17, 19, 20, 20] }, CURRENT_PREMISES);
  const noop = () => {};
  const renderWith = (audience: Audience, enabled: boolean, include = false, setEnabled = noop) =>
    render(
      <AudienceProvider initial={audience}>
        <B2cPanel input={input} enabled={enabled} include={include} set={noop} setEnabled={setEnabled} setInclude={noop} />
      </AudienceProvider>,
    );

  it('desabilitado: esconde campos e o include; mostra a chamada para habilitar', () => {
    renderWith('internal', false);
    expect(screen.getByText(/Habilitar módulo Assinaturas B2C/i)).toBeInTheDocument();
    expect(screen.queryByText(/Incluir na proposta/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fee de processamento/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Módulo desabilitado/i)).toBeInTheDocument();
  });

  it('habilitado (interna): revela campos, include e os números internos', () => {
    renderWith('internal', true);
    expect(screen.getByText(/Incluir na proposta/i)).toBeInTheDocument();
    expect(screen.getByText(/Fee de processamento/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Resultado Bondly/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Participação da Minu/i)).toBeInTheDocument();
  });

  it('habilitado (comercial): esconde custo interno (gateway, tributos, antifraude, Minu, Resultado); mantém oferta ao cliente', () => {
    renderWith('external', true);
    expect(screen.getByText(/Fee de processamento/i)).toBeInTheDocument(); // oferta ao cliente segue
    expect(screen.getByText(/Base elegível/i)).toBeInTheDocument();
    expect(screen.queryByText(/Resultado Bondly/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Participação da Minu/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Gateway/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tributos sobre o fee/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Antifraude/i)).not.toBeInTheDocument();
    // volume ao cliente permanece
    expect(screen.getByText(/Assinantes ativos em dez/i)).toBeInTheDocument();
    expect(screen.getByText(/Receita de processamento/i)).toBeInTheDocument();
  });

  it('o painel chama setEnabled (contrato do toggle de habilitar)', () => {
    const setEnabled = vi.fn();
    renderWith('internal', true, true, setEnabled);
    expect(typeof setEnabled).toBe('function');
    expect(screen.getByText(/Incluir na proposta/i)).toBeInTheDocument();
  });
});
