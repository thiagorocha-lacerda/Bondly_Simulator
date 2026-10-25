import { describe, it, expect, vi } from 'vitest';
import { render, screen, renderHook, act } from '@testing-library/react';
import { AudienceProvider, useAudience } from './audience';

describe('AudienceProvider / useAudience — fonte única de audience (§12/§16)', () => {
  it('internal=true quando audience=internal; false quando external', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AudienceProvider initial="external">{children}</AudienceProvider>
    );
    const { result } = renderHook(() => useAudience(), { wrapper });
    expect(result.current.audience).toBe('external');
    expect(result.current.internal).toBe(false);
    act(() => result.current.setAudience('internal'));
    expect(result.current.internal).toBe(true);
  });

  it('persiste a escolha em localStorage', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AudienceProvider initial="internal">{children}</AudienceProvider>
    );
    const { result } = renderHook(() => useAudience(), { wrapper });
    act(() => result.current.setAudience('external'));
    expect(localStorage.getItem('bondly-ws-audience')).toBe('external');
  });

  it('usar o hook fora do provider lança erro (fecha o buraco de superfície sem controle)', () => {
    function Bare() {
      useAudience();
      return null;
    }
    // Silencia o console.error esperado do React para este caso.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow(/AudienceProvider/);
    spy.mockRestore();
  });

  it('default é visão interna quando não há valor salvo', () => {
    localStorage.removeItem('bondly-ws-audience');
    render(
      <AudienceProvider>
        <Probe />
      </AudienceProvider>,
    );
    expect(screen.getByTestId('aud').textContent).toBe('internal');
  });
});

function Probe() {
  const { audience } = useAudience();
  return <span data-testid="aud">{audience}</span>;
}
