import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TierDiscountPanel } from './TierDiscountPanel';
import { DEFAULT_INPUT } from '../services/defaults';
import { calculate, type PricingInput } from '@bondly/pricing-engine';

function renderPanel(input: PricingInput, update = vi.fn()) {
  const result = calculate(input);
  render(<TierDiscountPanel input={input} result={result} update={update} />);
  return { update };
}

describe('TierDiscountPanel (§3.1)', () => {
  it('mostra o tier ativo e a faixa 3,00%–7,00%', () => {
    renderPanel(DEFAULT_INPUT); // 50k usuários → Growth
    expect(screen.getAllByText('Growth').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3,00%.*7,00%|3.00%.*7.00%/i).length).toBeGreaterThan(0);
  });

  it('valor válido (5) propaga a fração ao engine', async () => {
    const user = userEvent.setup();
    const { update } = renderPanel(DEFAULT_INPUT);
    const input = screen.getByLabelText(/Desconto do tier ativo/i);
    await user.clear(input);
    await user.type(input, '5');
    expect(update).toHaveBeenCalledWith({ negotiation: { tierDiscount: 0.05 } });
  });

  it('valor fora da faixa (2,99) mostra erro inline e NÃO propaga ao engine', async () => {
    const user = userEvent.setup();
    const { update } = renderPanel(DEFAULT_INPUT);
    const input = screen.getByLabelText(/Desconto do tier ativo/i);
    await user.clear(input);
    await user.type(input, '2.99');
    expect(await screen.findByRole('alert')).toHaveTextContent(/Mínimo/i);
    // nenhuma chamada propagou 0.0299
    const calls = update.mock.calls.map((c) => c[0]?.negotiation?.tierDiscount);
    expect(calls).not.toContain(0.0299);
  });

  it('acima do máximo (7,01) mostra erro "Máximo"', async () => {
    const user = userEvent.setup();
    renderPanel(DEFAULT_INPUT);
    const input = screen.getByLabelText(/Desconto do tier ativo/i);
    await user.clear(input);
    await user.type(input, '7.01');
    expect(await screen.findByRole('alert')).toHaveTextContent(/Máximo/i);
  });

  it('"Restaurar valores padrão" confirma e zera o desconto por tier', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const withDisc: PricingInput = { ...DEFAULT_INPUT, negotiation: { ...DEFAULT_INPUT.negotiation, tierDiscount: 0.05 } };
    const { update } = renderPanel(withDisc);
    await user.click(screen.getByRole('button', { name: /Restaurar valores padrão/i }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ negotiation: { tierDiscount: 0 } });
    confirmSpy.mockRestore();
  });

  it('mostra o waterfall quando há desconto aplicado', () => {
    const withDisc: PricingInput = { ...DEFAULT_INPUT, negotiation: { ...DEFAULT_INPUT.negotiation, tierDiscount: 0.05 } };
    renderPanel(withDisc);
    expect(screen.getByText(/Waterfall do Platform Fee/i)).toBeInTheDocument();
    expect(screen.getByText(/Platform Fee final/i)).toBeInTheDocument();
  });
});
