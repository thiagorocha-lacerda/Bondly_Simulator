import { describe, it, expect } from 'vitest';
import { authorizeIdentity, extractDomain, ALLOWED_DOMAINS } from './authz';

describe('extractDomain', () => {
  it('extrai o domínio após o último @', () => {
    expect(extractDomain('ana@minu.co')).toBe('minu.co');
    expect(extractDomain('a.b+tag@minutrade.com')).toBe('minutrade.com');
  });
  it('normaliza para minúsculas', () => {
    expect(extractDomain('Ana@MINU.CO')).toBe('minu.co');
  });
  it('usa a parte após o ÚLTIMO @ (defende contra local-part com @)', () => {
    // e-mails com @ escapado no local-part são raros, mas a regra é o último @
    expect(extractDomain('weird@foo@minu.co')).toBe('minu.co');
  });
  it('rejeita malformados', () => {
    expect(extractDomain('semarroba.com')).toBeNull();
    expect(extractDomain('@minu.co')).toBeNull();
    expect(extractDomain('ana@')).toBeNull();
    expect(extractDomain('ana@semponto')).toBeNull();
    expect(extractDomain('ana@.minu.co')).toBeNull();
    expect(extractDomain('ana@minu.co.')).toBeNull();
    expect(extractDomain('ana@minu..co')).toBeNull();
    expect(extractDomain('ana b@minu.co')).toBeNull();
  });
});

describe('authorizeIdentity — contas autorizadas (§9)', () => {
  for (const domain of ALLOWED_DOMAINS) {
    it(`autoriza conta verificada @${domain}`, () => {
      const r = authorizeIdentity({ email: `pessoa@${domain}`, email_verified: true });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.domain).toBe(domain);
    });
  }
});

describe('authorizeIdentity — negações (§9)', () => {
  it('nega gmail.com e domínios externos', () => {
    expect(authorizeIdentity({ email: 'x@gmail.com', email_verified: true }).ok).toBe(false);
    expect(authorizeIdentity({ email: 'x@outlook.com', email_verified: true }).ok).toBe(false);
  });

  it('nega e-mail não verificado (mesmo com domínio permitido)', () => {
    const r = authorizeIdentity({ email: 'x@minu.co', email_verified: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_verified');
  });

  it('nega quando email_verified não é estritamente boolean true', () => {
    expect(authorizeIdentity({ email: 'x@minu.co', email_verified: 'true' }).ok).toBe(false);
    expect(authorizeIdentity({ email: 'x@minu.co', email_verified: 1 }).ok).toBe(false);
    expect(authorizeIdentity({ email: 'x@minu.co', email_verified: undefined }).ok).toBe(false);
  });

  it('nega ausência de e-mail', () => {
    const r = authorizeIdentity({ email_verified: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no_email');
  });
});

describe('authorizeIdentity — bypasses que o §4 EXIGE recusar', () => {
  const attacks = [
    'usuario@minu.co.evil.com', // sufixo após o domínio permitido
    'usuario@sub.minu.co', //       subdomínio
    'usuario@minu.co.br', //        TLD estendido
    'usuario@notminu.co', //        prefixo coladinho
    'usuario@minu.com', //          domínio parecido (TLD diferente)
    'usuario@xminutrade.com', //    prefixo
    'usuario@grupoarka.com', //     .com em vez de .co
    'usuario@coremidia.co.evil.io',
    'minu.co@gmail.com', //         domínio permitido no LOCAL-part
    'usuario@EVIL.com#@minu.co.evil', // tentativa de confundir o parser
  ];
  for (const email of attacks) {
    it(`nega ${email}`, () => {
      const r = authorizeIdentity({ email, email_verified: true });
      expect(r.ok).toBe(false);
    });
  }
});
