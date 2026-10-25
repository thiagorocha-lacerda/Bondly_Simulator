import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { AudienceProvider } from './audience';

/**
 * §12/§16 — o ArkaPanel é qualificação interna (pipeline, elegibilidade a orçamento) e NÃO pode
 * aparecer em visão comercial. App começa em visão interna (ARKA visível); ao alternar para
 * comercial, o painel some.
 */
describe('App — ArkaPanel oculto em visão comercial (§12/§16)', () => {
  it('interna mostra o ARKA; comercial o oculta', async () => {
    const user = userEvent.setup();
    render(
      <AudienceProvider initial="internal">
        <App />
      </AudienceProvider>,
    );

    // Começa em visão interna → ARKA visível
    expect(screen.getByRole('heading', { name: /Evidência comercial — ARKA/i })).toBeInTheDocument();

    // Alterna para visão comercial → ARKA some
    await user.click(screen.getByRole('button', { name: /Visão comercial/i }));
    expect(screen.queryByRole('heading', { name: /Evidência comercial — ARKA/i })).not.toBeInTheDocument();

    // Volta para interna → ARKA reaparece
    await user.click(screen.getByRole('button', { name: /Visão interna/i }));
    expect(screen.getByRole('heading', { name: /Evidência comercial — ARKA/i })).toBeInTheDocument();
  });
});
