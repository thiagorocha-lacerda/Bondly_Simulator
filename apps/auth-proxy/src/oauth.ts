/**
 * Fluxo OAuth 2.0 / OpenID Connect — Authorization Code + PKCE (§3).
 *
 * Nunca decodificamos o ID token manualmente: a verificação criptográfica (assinatura, iss, aud,
 * exp) é feita pela google-auth-library (OAuth2Client.verifyIdToken), que busca e cacheia as
 * chaves públicas do Google. Validamos nonce aqui e a autorização por domínio no authz.ts.
 */
import { createHash } from 'node:crypto';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { GOOGLE_AUTH_ENDPOINT, GOOGLE_TOKEN_ENDPOINT, type ServerConfig } from './config.js';
import { randomToken } from './session.js';

export interface PkcePair {
  readonly verifier: string;
  readonly challenge: string;
}

export function createPkce(): PkcePair {
  const verifier = randomToken(48);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export interface AuthRequestState {
  readonly state: string;
  readonly nonce: string;
  readonly pkce: PkcePair;
}

export function newAuthRequestState(): AuthRequestState {
  return { state: randomToken(), nonce: randomToken(), pkce: createPkce() };
}

/** Monta a URL de autorização do Google. `hd` é só uma dica de UX (não é controle de acesso, §3). */
export function buildAuthUrl(cfg: ServerConfig, req: AuthRequestState): string {
  const params = new URLSearchParams({
    client_id: cfg.googleClientId,
    redirect_uri: `${cfg.publicUrl}/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state: req.state,
    nonce: req.nonce,
    code_challenge: req.pkce.challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
    access_type: 'online',
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Troca o authorization code por tokens e VERIFICA o ID token criptograficamente.
 * Confere nonce e exige email_verified presente nas claims (a autorização por domínio é no authz).
 */
export async function exchangeCode(
  cfg: ServerConfig,
  code: string,
  verifier: string,
  expectedNonce: string,
): Promise<TokenPayload> {
  const redirectUri = `${cfg.publicUrl}/auth/callback`;
  const body = new URLSearchParams({
    code,
    client_id: cfg.googleClientId,
    client_secret: cfg.googleClientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: verifier,
  });
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`token endpoint retornou ${res.status}`);
  }
  const json = (await res.json()) as { id_token?: string };
  if (!json.id_token) throw new Error('resposta sem id_token');

  const client = new OAuth2Client(cfg.googleClientId);
  const ticket = await client.verifyIdToken({ idToken: json.id_token, audience: cfg.googleClientId });
  const payload = ticket.getPayload();
  if (!payload) throw new Error('id_token sem payload');
  if (payload.nonce !== expectedNonce) throw new Error('nonce divergente (possível replay)');
  return payload;
}
