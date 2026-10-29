/**
 * Sessão server-side leve (§6/§8).
 *
 * A sessão é um payload JSON compacto assinado com HMAC-SHA256 pela SESSION_SECRET do servidor
 * e entregue em cookie HttpOnly/Secure/SameSite=Lax. Não guardamos tokens do Google no cookie —
 * só a identidade mínima já autorizada (e-mail, nome, foto) e a expiração. A assinatura impede
 * forjar/alterar o conteúdo no cliente (o segredo nunca sai do servidor).
 *
 * Decisão: cookie assinado stateless (sem store) é suficiente para esta app — a revogação se dá
 * por expiração curta + logout que limpa o cookie. Um store server-side seria o passo da Opção A.
 */
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { serialize, parse } from 'cookie';
import { isRole, type Role } from './rbac.js';

export const SESSION_COOKIE = 'bondly_sess';
export const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8h

export interface SessionData {
  readonly email: string;
  readonly name?: string;
  readonly picture?: string;
  readonly domain: string;
  /** Papel elevado pelo 2º fator (§7.2); ausente = autenticado por Google mas sem perfil. */
  readonly role?: Role;
  /** epoch seconds de expiração */
  readonly exp: number;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function sign(payloadB64: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(payloadB64).digest());
}

/** Cria o valor do cookie: <payload base64url>.<assinatura base64url>. */
export function createSessionToken(data: Omit<SessionData, 'exp'>, secret: string, now = Date.now()): string {
  const full: SessionData = { ...data, exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(full), 'utf8'));
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

/** Verifica assinatura + expiração. Retorna a sessão ou null (nunca lança). */
export function verifySessionToken(token: string | undefined, secret: string, now = Date.now()): SessionData | null {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payloadB64, secret);
  // comparação em tempo constante
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let data: SessionData;
  try {
    data = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as SessionData;
  } catch {
    return null;
  }
  if (typeof data.exp !== 'number' || data.exp <= Math.floor(now / 1000)) return null;
  if (typeof data.email !== 'string' || typeof data.domain !== 'string') return null;
  // role é opcional; quando presente precisa ser um papel válido (senão a sessão é rejeitada)
  if (data.role !== undefined && !isRole(data.role)) return null;
  return data;
}

export function sessionSetCookie(token: string, secure: boolean): string {
  return serialize(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function sessionClearCookie(secure: boolean): string {
  return serialize(SESSION_COOKIE, '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function readCookies(header: string | undefined): Record<string, string | undefined> {
  if (!header) return {};
  return parse(header);
}

/** Gera um valor opaco para state/nonce/PKCE verifier. */
export function randomToken(bytes = 32): string {
  return b64url(randomBytes(bytes));
}

/* ------------------------------------------------------------------ *
 * Flow cookie: carrega state/nonce/PKCE-verifier/returnTo ENTRE o início
 * do OAuth (/auth/login) e o callback. Assinado com o mesmo segredo e com
 * vida curta (10 min). É o que ancora o `state` ao navegador de origem,
 * fechando CSRF/session-fixation no fluxo (§8).
 * ------------------------------------------------------------------ */
const FLOW_COOKIE = 'bondly_flow';
const FLOW_TTL_SECONDS = 10 * 60;

export interface FlowData {
  readonly state: string;
  readonly nonce: string;
  readonly verifier: string;
  readonly returnTo: string;
  readonly exp: number;
}

export function serializeFlowCookie(
  data: Omit<FlowData, 'exp'>,
  secret: string,
  secure: boolean,
  now = Date.now(),
): string {
  const full: FlowData = { ...data, exp: Math.floor(now / 1000) + FLOW_TTL_SECONDS };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(full), 'utf8'));
  const sig = sign(payloadB64, secret);
  return serialize(FLOW_COOKIE, `${payloadB64}.${sig}`, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: FLOW_TTL_SECONDS,
  });
}

export function readFlowCookie(
  cookies: Record<string, string | undefined>,
  secret: string,
  now = Date.now(),
): FlowData | null {
  const token = cookies[FLOW_COOKIE];
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payloadB64, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let data: FlowData;
  try {
    data = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as FlowData;
  } catch {
    return null;
  }
  if (typeof data.exp !== 'number' || data.exp <= Math.floor(now / 1000)) return null;
  if (typeof data.state !== 'string' || typeof data.verifier !== 'string' || typeof data.nonce !== 'string') return null;
  return data;
}

export function clearFlowCookie(secure: boolean): string {
  return serialize(FLOW_COOKIE, '', { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 0 });
}
