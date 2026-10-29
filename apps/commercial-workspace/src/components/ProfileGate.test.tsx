import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileGate } from './ProfileGate';

describe('ProfileGate (§7.2)', () => {
  it('mostra o e-mail autenticado e pede o código', () => {
    render(<ProfileGate email="ana@minu.co" onUnlock={vi.fn()} />);
    expect(screen.getByText('ana@minu.co')).toBeInTheDocument();
    expect(screen.getByLabelText(/Código de acesso/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Negócios/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Projetos & Tecnologia/i })).toBeInTheDocument();
  });

  it('chama onUnlock com o papel e o código', async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn().mockResolvedValue(true);
    render(<ProfileGate email="ana@minu.co" onUnlock={onUnlock} />);
    await user.type(screen.getByLabelText(/Código de acesso/i), 'segredo');
    await user.click(screen.getByRole('button', { name: /Desbloquear perfil/i }));
    expect(onUnlock).toHaveBeenCalledWith('business', 'segredo');
  });

  it('mostra erro quando o unlock falha', async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn().mockResolvedValue(false);
    render(<ProfileGate email="ana@minu.co" onUnlock={onUnlock} />);
    await user.type(screen.getByLabelText(/Código de acesso/i), 'errado');
    await user.click(screen.getByRole('button', { name: /Desbloquear perfil/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/inválido/i);
  });

  it('seleciona o perfil Projetos & Tecnologia antes de desbloquear', async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn().mockResolvedValue(true);
    render(<ProfileGate email="tec@minu.co" onUnlock={onUnlock} />);
    await user.click(screen.getByRole('button', { name: /Projetos & Tecnologia/i }));
    await user.type(screen.getByLabelText(/Código de acesso/i), 'tek');
    await user.click(screen.getByRole('button', { name: /Desbloquear perfil/i }));
    expect(onUnlock).toHaveBeenCalledWith('tech', 'tek');
  });
});
