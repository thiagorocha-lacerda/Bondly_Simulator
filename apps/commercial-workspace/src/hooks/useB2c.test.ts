import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useB2c } from './useB2c';

describe('useB2c — habilitação do módulo de vendas', () => {
  beforeEach(() => localStorage.clear());

  it('começa desabilitado e não incluído', () => {
    const { result } = renderHook(() => useB2c());
    expect(result.current.enabled).toBe(false);
    expect(result.current.include).toBe(false);
  });

  it('desabilitar o módulo força include=false (não dá para incluir o que está desligado)', () => {
    const { result } = renderHook(() => useB2c());
    act(() => result.current.setEnabled(true));
    act(() => result.current.setInclude(true));
    expect(result.current.include).toBe(true);
    act(() => result.current.setEnabled(false));
    expect(result.current.enabled).toBe(false);
    expect(result.current.include).toBe(false); // encadeado
  });

  it('persiste enabled em localStorage', () => {
    const { result } = renderHook(() => useB2c());
    act(() => result.current.setEnabled(true));
    expect(localStorage.getItem('bondly-ws-b2c-enabled')).toBe('1');
  });

  it('boot normaliza include órfão: include=1 salvo com enabled!=1 carrega como false', () => {
    // Simula localStorage de versão anterior (antes do encadeamento enabled→include).
    localStorage.setItem('bondly-ws-b2c-include', '1');
    localStorage.removeItem('bondly-ws-b2c-enabled'); // enabled ausente/false
    const { result } = renderHook(() => useB2c());
    expect(result.current.enabled).toBe(false);
    expect(result.current.include).toBe(false); // normalizado no boot
  });
});
