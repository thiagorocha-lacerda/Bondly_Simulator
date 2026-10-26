/**
 * Autorização estrita por domínio (§4).
 *
 * Esta é a decisão de controle de acesso. Mantida PURA e sem I/O para ser exaustivamente
 * testável contra os bypasses que o prompt exige recusar:
 *   usuario@minu.co.evil.com   (sufixo após o domínio permitido)
 *   usuario@sub.minu.co        (subdomínio)
 *   usuario@minu.co.br         (sufixo de TLD)
 *   "contém" minu.co em qualquer posição
 *
 * Regra: o domínio é a parte APÓS O ÚLTIMO '@', normalizada para minúsculas, e precisa bater
 * EXATAMENTE (igualdade de string) com um dos domínios permitidos. Sem correspondência parcial,
 * sem endsWith, sem includes.
 */

export const ALLOWED_DOMAINS: readonly string[] = [
  'minu.co',
  'minutrade.com',
  'grupoarka.co',
  'brain3.com.br',
  'coremidia.co',
];

export interface IdentityClaims {
  readonly email?: unknown;
  readonly email_verified?: unknown;
}

export type AuthzResult =
  | { readonly ok: true; readonly email: string; readonly domain: string }
  | { readonly ok: false; readonly reason: 'no_email' | 'not_verified' | 'malformed_email' | 'domain_not_allowed' };

/**
 * Extrai o domínio do e-mail de forma segura: parte após o ÚLTIMO '@'.
 * Retorna null para e-mail malformado (sem '@', '@' final, '@' inicial, múltiplas partes vazias).
 */
export function extractDomain(email: string): string | null {
  if (/\s/.test(email)) return null; // e-mail válido não contém espaços em nenhuma parte
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return null; // sem '@', '@' no início, ou '@' no fim
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (local.length === 0) return null;
  // domínio não pode conter outro '@'; precisa de ao menos um ponto e labels não-vazias
  if (domain.includes('@')) return null;
  if (!domain.includes('.')) return null;
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return null;
  return domain;
}

/**
 * Decide a autorização a partir das claims JÁ VERIFICADAS criptograficamente pelo chamador.
 * NUNCA chame isto com dados não verificados (e-mail digitado, hd, query string).
 */
export function authorizeIdentity(claims: IdentityClaims): AuthzResult {
  // email_verified precisa ser estritamente true (boolean) — não 'true' string, não truthy.
  if (claims.email_verified !== true) {
    // distingue ausência de e-mail de e-mail não verificado para log interno
    if (typeof claims.email !== 'string' || claims.email.length === 0) {
      return { ok: false, reason: 'no_email' };
    }
    return { ok: false, reason: 'not_verified' };
  }
  if (typeof claims.email !== 'string' || claims.email.length === 0) {
    return { ok: false, reason: 'no_email' };
  }
  const email = claims.email.trim();
  const domain = extractDomain(email);
  if (domain === null) {
    return { ok: false, reason: 'malformed_email' };
  }
  // Correspondência EXATA. Set para O(1); igualdade de string, nada de endsWith/includes.
  if (!ALLOWED_DOMAINS.includes(domain)) {
    return { ok: false, reason: 'domain_not_allowed' };
  }
  return { ok: true, email: email.toLowerCase(), domain };
}
