/**
 * Servidor BFF / proxy de borda (Opção B).
 *
 * Responsabilidades:
 *  - rotas públicas: /login (tela), /healthz, /auth/login (inicia OAuth), /auth/callback
 *  - gate: QUALQUER outra rota exige sessão válida; sem ela → 302 /login (ou 401 em /api/*)
 *  - entrega protegida do SPA estático (dist) somente após sessão
 *
 * Limite honesto (§5): as regras de pricing seguem no bundle servido. Este proxy impede ACESSO
 * sem sessão; não cifra o conteúdo para quem já está autenticado. Mover cálculo/dados para o
 * servidor seria a Opção A.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { loadConfig, REDIRECT_PATH } from './config.js';
import {
  SESSION_COOKIE,
  createSessionToken,
  verifySessionToken,
  sessionSetCookie,
  sessionClearCookie,
  readCookies,
  serializeFlowCookie,
  readFlowCookie,
  clearFlowCookie,
} from './session.js';
import { newAuthRequestState, buildAuthUrl, exchangeCode } from './oauth.js';
import { authorizeIdentity } from './authz.js';
import { renderLoginPage } from './login-page.js';

const cfg = loadConfig();

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function securityHeaders(res: ServerResponse, isHtml: boolean): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  if (isHtml) {
    // páginas privadas nunca em cache compartilhado (§8)
    res.setHeader('Cache-Control', 'no-store');
  }
}

function redirect(res: ServerResponse, location: string, cookies: string[] = []): void {
  if (cookies.length) res.setHeader('Set-Cookie', cookies);
  res.writeHead(302, { Location: location });
  res.end();
}

function send(res: ServerResponse, status: number, body: string, contentType = 'text/plain; charset=utf-8', cookies: string[] = []): void {
  if (cookies.length) res.setHeader('Set-Cookie', cookies);
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

async function serveStatic(res: ServerResponse, urlPath: string): Promise<void> {
  // normaliza e impede path traversal para fora do dist
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.(\/|\\|$))+/, '');
  let filePath = join(cfg.staticDir, rel);
  if (!filePath.startsWith(cfg.staticDir)) {
    send(res, 403, 'forbidden');
    return;
  }
  let isHtmlFallback = false;
  try {
    const s = await stat(filePath);
    if (s.isDirectory()) {
      filePath = join(filePath, 'index.html');
    }
  } catch {
    // SPA fallback: rota sem arquivo → index.html (mas preserva /assets/* como 404 real)
    if (rel.startsWith('assets/')) {
      send(res, 404, 'not found');
      return;
    }
    filePath = join(cfg.staticDir, 'index.html');
    isHtmlFallback = true;
  }
  try {
    const data = await readFile(filePath);
    const ext = isHtmlFallback ? '.html' : extname(filePath);
    const isHtml = ext === '.html';
    securityHeaders(res, isHtml);
    if (ext === '.js' || ext === '.css' || ext === '.woff2' || ext === '.png' || ext === '.svg') {
      // assets com hash: imutáveis; mas ainda protegidos por sessão (não public cache em HTML)
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    send(res, 404, 'not found');
  }
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', cfg.publicUrl || `http://${req.headers.host}`);
  const path = url.pathname;
  const cookies = readCookies(req.headers.cookie);
  const session = verifySessionToken(cookies[SESSION_COOKIE], cfg.sessionSecret);

  // --- rotas públicas ---
  if (path === '/healthz') {
    send(res, 200, JSON.stringify({ ok: true }), 'application/json; charset=utf-8');
    return;
  }

  if (path === '/login') {
    if (session) return redirect(res, '/');
    const err = url.searchParams.get('error');
    securityHeaders(res, true);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderLoginPage(err));
    return;
  }

  if (path === '/auth/login') {
    const reqState = newAuthRequestState();
    const flow = serializeFlowCookie(
      { state: reqState.state, nonce: reqState.nonce, verifier: reqState.pkce.verifier, returnTo: url.searchParams.get('returnTo') ?? '/' },
      cfg.sessionSecret,
      cfg.isProd,
    );
    redirect(res, buildAuthUrl(cfg, reqState), [flow]);
    return;
  }

  if (path === REDIRECT_PATH) {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const oauthErr = url.searchParams.get('error');
    const flow = readFlowCookie(cookies, cfg.sessionSecret);
    if (oauthErr) return redirect(res, '/login?error=cancelled', [clearFlowCookie(cfg.isProd)]);
    if (!code || !state || !flow || state !== flow.state) {
      return redirect(res, '/login?error=state', [clearFlowCookie(cfg.isProd)]);
    }
    try {
      const payload = await exchangeCode(cfg, code, flow.verifier, flow.nonce);
      const authz = authorizeIdentity({ email: payload.email, email_verified: payload.email_verified });
      if (!authz.ok) {
        console.warn(JSON.stringify({ evt: 'login_denied', reason: authz.reason, domain_hint: payload.hd ?? null }));
        return redirect(res, '/login?error=unauthorized', [clearFlowCookie(cfg.isProd)]);
      }
      const token = createSessionToken(
        { email: authz.email, name: payload.name, picture: payload.picture, domain: authz.domain },
        cfg.sessionSecret,
      );
      console.info(JSON.stringify({ evt: 'login_ok', domain: authz.domain }));
      const returnTo = flow.returnTo && flow.returnTo.startsWith('/') && !flow.returnTo.startsWith('//') ? flow.returnTo : '/';
      return redirect(res, returnTo, [sessionSetCookie(token, cfg.isProd), clearFlowCookie(cfg.isProd)]);
    } catch (e) {
      console.error(JSON.stringify({ evt: 'login_error', msg: (e as Error).message }));
      return redirect(res, '/login?error=provider', [clearFlowCookie(cfg.isProd)]);
    }
  }

  if (path === '/auth/logout') {
    if (session) console.info(JSON.stringify({ evt: 'logout', domain: session.domain }));
    return redirect(res, '/login', [sessionClearCookie(cfg.isProd)]);
  }

  // --- a partir daqui, tudo exige sessão ---
  if (!session) {
    if (path.startsWith('/api/')) {
      send(res, 401, JSON.stringify({ error: 'unauthenticated' }), 'application/json; charset=utf-8');
      return;
    }
    const returnTo = encodeURIComponent(path + url.search);
    return redirect(res, `/login?returnTo=${returnTo}`);
  }

  // sessão válida — expõe a identidade ao frontend (sem segredos) e serve o SPA
  if (path === '/api/me') {
    send(
      res,
      200,
      JSON.stringify({ email: session.email, name: session.name ?? null, picture: session.picture ?? null, domain: session.domain }),
      'application/json; charset=utf-8',
    );
    return;
  }

  await serveStatic(res, path === '/' ? '/index.html' : path);
}

const server = createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error(JSON.stringify({ evt: 'unhandled', msg: (e as Error).message }));
    if (!res.headersSent) send(res, 500, 'internal error');
  });
});

server.listen(cfg.port, () => {
  console.info(JSON.stringify({ evt: 'listening', port: cfg.port, prod: cfg.isProd, publicUrl: cfg.publicUrl }));
});
