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

  it('módulo B2C aparece no modo rápido (habilitável nos dois modos)', () => {
    render(
      <AudienceProvider initial="internal">
        <App />
      </AudienceProvider>,
    );
    // começa no modo rápido
    expect(screen.getByRole('tab', { name: /Modo rápido/i })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText(/Habilitar módulo Assinaturas B2C/i)).toBeInTheDocument();
  });

  it('visão comercial = modo rápido: esconde os tabs de modo e os painéis de custo interno do avançado', async () => {
    const user = userEvent.setup();
    render(
      <AudienceProvider initial="internal">
        <App />
      </AudienceProvider>,
    );
    await user.click(screen.getByRole('tab', { name: /Modo avançado/i }));
    // interna + avançado: painéis internos presentes
    expect(screen.getByRole('heading', { name: /Serviços — recursos dedicados/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Campanhas de marketing/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Comunicação transacional/i })).toBeInTheDocument();

    // comercial: tabs de modo somem e a view cai para modo rápido
    await user.click(screen.getByRole('button', { name: /Visão comercial/i }));
    expect(screen.queryByRole('tab', { name: /Modo avançado/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Modo rápido/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Serviços — recursos dedicados/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Campanhas de marketing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Comunicação transacional/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Leitura de notas fiscais/i })).not.toBeInTheDocument();
    // QuickMode visível (campo exclusivo do rápido) + B2C permanece (é venda, não custo interno)
    expect(screen.getByText(/MAU \(% da base\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Habilitar módulo Assinaturas B2C/i)).toBeInTheDocument();
  });
});
