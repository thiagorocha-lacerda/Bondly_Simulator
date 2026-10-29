import { describe, it, expect } from 'vitest';
import { scryptHasher, verifyProfileCode, loadProfileCodeHashes, type ProfileCodeHashes } from './profileCodes.js';

describe('PasswordHasher scrypt (§7.3)', () => {
  it('hash é salgado (dois hashes do mesmo segredo diferem) e verifica', () => {
    const a = scryptHasher.hash('segredo-123');
    const b = scryptHasher.hash('segredo-123');
    expect(a).not.toBe(b); // sal aleatório
    expect(a.startsWith('scrypt$')).toBe(true);
    expect(scryptHasher.verify('segredo-123', a)).toBe(true);
    expect(scryptHasher.verify('segredo-123', b)).toBe(true);
  });
  it('código errado não verifica', () => {
    const h = scryptHasher.hash('correto');
    expect(scryptHasher.verify('errado', h)).toBe(false);
  });
  it('hash malformado/adulterado não verifica (nunca lança)', () => {
    expect(scryptHasher.verify('x', 'lixo')).toBe(false);
    expect(scryptHasher.verify('x', 'scrypt$16384$8$1$sal')).toBe(false);
    expect(scryptHasher.verify('x', 'bcrypt$1$2$3$4$5')).toBe(false);
  });
});

describe('verifyProfileCode — 2º fator por perfil (§7.2)', () => {
  const hashes: ProfileCodeHashes = {
    business: scryptHasher.hash('codigo-negocios'),
    tech: scryptHasher.hash('codigo-tecnico'),
    // admin propositalmente sem código configurado
  };

  it('código certo eleva ao papel', () => {
    expect(verifyProfileCode('business', 'codigo-negocios', hashes)).toMatchObject({ ok: true, role: 'business' });
    expect(verifyProfileCode('tech', 'codigo-tecnico', hashes)).toMatchObject({ ok: true, role: 'tech' });
  });
  it('código errado recusa (bad_code)', () => {
    expect(verifyProfileCode('business', 'chute', hashes)).toMatchObject({ ok: false, reason: 'bad_code' });
  });
  it('código de um papel NÃO desbloqueia outro papel', () => {
    expect(verifyProfileCode('tech', 'codigo-negocios', hashes)).toMatchObject({ ok: false, reason: 'bad_code' });
  });
  it('papel sem código configurado é inatingível (not_configured)', () => {
    expect(verifyProfileCode('admin', 'qualquer', hashes)).toMatchObject({ ok: false, reason: 'not_configured' });
  });
  it('papel desconhecido recusa (unknown_role)', () => {
    expect(verifyProfileCode('root', 'x', hashes)).toMatchObject({ ok: false, reason: 'unknown_role' });
  });
  it('código vazio recusa', () => {
    expect(verifyProfileCode('business', '', hashes)).toMatchObject({ ok: false, reason: 'bad_code' });
  });
});

describe('loadProfileCodeHashes — do ambiente, nunca do bundle', () => {
  it('carrega só os papéis com hash definido', () => {
    const env = { PROFILE_CODE_HASH_BUSINESS: 'scrypt$x', PROFILE_CODE_HASH_TECH: 'scrypt$y' } as NodeJS.ProcessEnv;
    const h = loadProfileCodeHashes(env);
    expect(h.business).toBe('scrypt$x');
    expect(h.tech).toBe('scrypt$y');
    expect(h.admin).toBeUndefined();
  });
});
