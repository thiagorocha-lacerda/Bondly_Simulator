import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServicesPanel } from './ServicesPanel';
import { DEFAULT_INPUT } from '../services/defaults';
import type { PricingInput } from '@bondly/pricing-engine';

/** §7.2 — perfis de serviço podem ser adicionados E removidos. */
describe('ServicesPanel — remover perfil', () => {
  const twoProfiles: PricingInput = {
    ...DEFAULT_INPUT,
    services: {
      ...DEFAULT_INPUT.services,
      profiles: [
        { name: 'Perfil A', quantity: 1, totalCompensation: 25000, directCosts: 0 },
        { name: 'Perfil B', quantity: 1, totalCompensation: 25000, directCosts: 0 },
      ],
    },
  };

  it('com 2+ perfis mostra o botão remover e chama update sem o perfil removido', async () => {
    const user = userEvent.setup();
    const update = vi.fn();
    render(<ServicesPanel input={twoProfiles} update={update} />);

    const removeButtons = screen.getAllByRole('button', { name: /Remover/i });
    expect(removeButtons.length).toBe(2);

    await user.click(removeButtons[0]!);
    expect(update).toHaveBeenCalledWith({ services: { profiles: [twoProfiles.services.profiles[1]] } });
  });

  it('com 1 perfil (fallback) não mostra botão remover — não dá para remover o único', () => {
    render(<ServicesPanel input={DEFAULT_INPUT} update={() => {}} />);
    expect(screen.queryByRole('button', { name: /Remover/i })).not.toBeInTheDocument();
  });
});
