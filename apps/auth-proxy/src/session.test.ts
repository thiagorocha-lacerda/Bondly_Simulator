import { describe, it, expect } from 'vitest';
import { createSessionToken, verifySessionToken, SESSION_TTL_SECONDS } from './session';

const SECRET = 'test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('session token', () => {
  it('round-trip: cria e verifica uma sessão válida', () => {
    const t = createSessionToken({ email: 'ana@minu.co', domain: 'minu.co', name: 'Ana' }, SECRET);
    const s = verifySessionToken(t, SECRET);
    expect(s?.email).toBe('ana@minu.co');
    expect(s?.domain).toBe('minu.co');
    expect(s?.name).toBe('Ana');
  });

  it('rejeita assinatura adulterada', () => {
    const t = createSessionToken({ email: 'ana@minu.co', domain: 'minu.co' }, SECRET);
    const [payload] = t.split('.');
    const forged = `${payload}.${'A'.repeat(43)}`;
    expect(verifySessionToken(forged, SECRET)).toBeNull();
  });

  it('rejeita payload adulterado (muda e-mail, assinatura não bate)', () => {
    const t = createSessionToken({ email: 'ana@minu.co', domain: 'minu.co' }, SECRET);
    const sig = t.split('.')[1];
    const evilPayload = Buffer.from(JSON.stringify({ email: 'evil@gmail.com', domain: 'gmail.com', exp: 9999999999 }), 'utf8').toString('base64url');
    expect(verifySessionToken(`${evilPayload}.${sig}`, SECRET)).toBeNull();
  });

  it('rejeita segredo diferente', () => {
    const t = createSessionToken({ email: 'ana@minu.co', domain: 'minu.co' }, SECRET);
    expect(verifySessionToken(t, 'outro-segredo')).toBeNull();
  });

  it('rejeita sessão expirada', () => {
    const past = Date.now() - (SESSION_TTL_SECONDS + 60) * 1000;
    const t = createSessionToken({ email: 'ana@minu.co', domain: 'minu.co' }, SECRET, past);
    expect(verifySessionToken(t, SECRET)).toBeNull();
  });

  it('rejeita token vazio/malformado', () => {
    expect(verifySessionToken(undefined, SECRET)).toBeNull();
    expect(verifySessionToken('', SECRET)).toBeNull();
    expect(verifySessionToken('semponto', SECRET)).toBeNull();
    expect(verifySessionToken('.sig', SECRET)).toBeNull();
  });
});
