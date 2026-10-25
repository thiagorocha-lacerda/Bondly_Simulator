import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScenarioPanel } from './ScenarioPanel';
import { DEFAULT_INPUT } from '../services/defaults';

/**
 * §12/§16 — a tabela de cenários NA TELA não pode expor margem técnica/status (internos) em visão
 * comercial. Em visão interna, as colunas aparecem. (O PDF já segue o mesmo contrato.)
 */
describe('ScenarioPanel — confidencialidade por audience (§12/§16)', () => {
  it('visão interna: mostra Margem técnica e Status', () => {
    render(<ScenarioPanel input={DEFAULT_INPUT} audience="internal" />);
    expect(screen.getByText(/Margem técnica/i)).toBeInTheDocument();
    expect(screen.getByText(/^Status$/i)).toBeInTheDocument();
  });

  it('visão comercial: oculta Margem técnica e Status; mantém Core MRR e TCV', () => {
    render(<ScenarioPanel input={DEFAULT_INPUT} audience="external" />);
    expect(screen.queryByText(/Margem técnica/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Status$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Core MRR/i)).toBeInTheDocument();
    expect(screen.getByText(/TCV ao cliente/i)).toBeInTheDocument();
  });
});
