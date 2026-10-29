import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SetupPanel } from './SetupPanel';
import { DEFAULT_INPUT } from '../services/defaults';
import { calculate, type PricingInput } from '@bondly/pricing-engine';

function renderPanel(input: PricingInput, internal = true, update = vi.fn()) {
  const result = calculate(input);
  render(<SetupPanel input={input} result={result} update={update} internal={internal} />);
  return { update };
}

describe('SetupPanel (§4.2)', () => {
  it('mostra os componentes do Setup: fixo, horas, total, mensalidade, TCV', () => {
    renderPanel(DEFAULT_INPUT);
    expect(screen.getAllByText(/Setup fixo padrão/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Horas adicionais de implantação/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Setup total/i)).toBeInTheDocument();
    expect(screen.getByText(/Mensalidade recorrente/i)).toBeInTheDocument();
    expect(screen.getByText(/TCV ao cliente/i)).toBeInTheDocument();
  });

  it('redução do Setup fixo propaga a fração ao engine', () => {
    const { update } = renderPanel(DEFAULT_INPUT);
    // 0 = Redução (%), 1 = Outros adicionais (R$) — Fields não associa label/input
    const reduction = screen.getAllByRole('spinbutton')[0]!;
    fireEvent.change(reduction, { target: { value: '20' } });
    expect(update).toHaveBeenCalledWith({ negotiation: { setupFixedReductionPct: 0.2 } });
  });

  it('outros adicionais propagam o valor em R$ ao engine', () => {
    const { update } = renderPanel(DEFAULT_INPUT);
    const other = screen.getAllByRole('spinbutton')[1]!;
    fireEvent.change(other, { target: { value: '5000' } });
    expect(update).toHaveBeenCalledWith({ negotiation: { setupOtherAdditions: 5000 } });
  });

  it('visão comercial (não interna) mostra o Setup ao cliente como total, sem linha de líquido Bondly', () => {
    renderPanel(DEFAULT_INPUT, false);
    expect(screen.queryByText(/líquido Bondly/i)).not.toBeInTheDocument();
  });
});
