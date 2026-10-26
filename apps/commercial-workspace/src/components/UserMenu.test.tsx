import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserMenu } from './UserMenu';

describe('UserMenu (§6)', () => {
  it('não renderiza nada sem usuário', () => {
    const { container } = render(<UserMenu user={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('mostra nome, e-mail e botão Sair com usuário autenticado', () => {
    render(<UserMenu user={{ email: 'ana@minu.co', name: 'Ana Souza', picture: null, domain: 'minu.co' }} />);
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('ana@minu.co')).toBeInTheDocument();
    const sair = screen.getByText('Sair');
    expect(sair).toHaveAttribute('href', '/auth/logout');
  });

  it('usa a inicial como fallback quando não há foto', () => {
    render(<UserMenu user={{ email: 'bruno@coremidia.co', name: null, picture: null, domain: 'coremidia.co' }} />);
    expect(screen.getByText('B')).toBeInTheDocument(); // inicial do e-mail
  });
});
