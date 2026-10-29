/**
 * Configuração do servidor a partir do ambiente (§7). Validada no boot: faltando um segredo
 * obrigatório em produção, o processo recusa subir (fail-fast) em vez de rodar inseguro.
 */

import type { ProfileCodeHashes } from './profileCodes.js';
import { loadProfileCodeHashes } from './profileCodes.js';

export interface ServerConfig {
  readonly port: number;
  readonly isProd: boolean;
  readonly googleClientId: string;
  readonly googleClientSecret: string;
  readonly sessionSecret: string;
  /** Base URL pública (ex.: https://bondly-simulator.onrender.com), usada no redirect_uri. */
  readonly publicUrl: string;
  /** Diretório com o dist do SPA a servir. */
  readonly staticDir: string;
  /** Hashes dos códigos de perfil (2º fator §7.2); vazio = papel inatingível por código. */
  readonly profileCodeHashes: ProfileCodeHashes;
}

function required(name: string, value: string | undefined, isProd: boolean, devFallback?: string): string {
  if (value && value.length > 0) return value;
  if (!isProd && devFallback !== undefined) return devFallback;
  throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const isProd = (env.NODE_ENV ?? 'production') === 'production';
  const port = Number(env.PORT ?? 10000);
  const publicUrl = (env.PUBLIC_URL ?? (isProd ? '' : `http://127.0.0.1:${port}`)).replace(/\/$/, '');
  if (isProd && !publicUrl) throw new Error('Variável de ambiente obrigatória ausente: PUBLIC_URL');

  return {
    port,
    isProd,
    googleClientId: required('GOOGLE_CLIENT_ID', env.GOOGLE_CLIENT_ID, isProd, 'dev-client-id.apps.googleusercontent.com'),
    googleClientSecret: required('GOOGLE_CLIENT_SECRET', env.GOOGLE_CLIENT_SECRET, isProd, 'dev-client-secret'),
    sessionSecret: required('SESSION_SECRET', env.SESSION_SECRET, isProd, 'dev-session-secret-not-for-production-use'),
    publicUrl,
    staticDir: env.STATIC_DIR ?? new URL('../../commercial-workspace/dist', import.meta.url).pathname,
    profileCodeHashes: loadProfileCodeHashes(env),
  };
}

export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const REDIRECT_PATH = '/auth/callback';
