/**
 * Tela de login Bondly (§3/§6/§10) — server-rendered, servida ANTES de qualquer bundle privado.
 * Botão único "Continuar com Google". Responsiva, acessível, respeita prefers-color-scheme.
 * Mensagens de erro claras sem vazar detalhes internos de validação.
 */

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: 'Acesso não autorizado. Utilize uma conta Google corporativa de um dos domínios permitidos.',
  cancelled: 'Login cancelado. Tente novamente quando quiser.',
  state: 'A sessão de login expirou ou é inválida. Tente novamente.',
  provider: 'Não foi possível concluir o login com o Google agora. Tente novamente em instantes.',
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export function renderLoginPage(error?: string | null): string {
  const msg = error ? ERROR_MESSAGES[error] ?? ERROR_MESSAGES.provider : null;
  const errorBlock = msg
    ? `<div class="alert" role="alert">${esc(msg)}</div>`
    : '';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Entrar · Bondly Commercial Workspace</title>
<style>
  :root {
    --navy: #2a2470; --amber: #ffc81e; --ink: #11131f; --muted: #5f6479;
    --bg: #f6f4ee; --surface: #ffffff; --border: #e4e0d6; --text: #11131f;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0b0d16; --surface: #11131f; --border: #272b3d; --text: #eef0f6; --muted: #9aa0b8; }
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: var(--bg); color: var(--text);
    display: grid; place-items: center; padding: 24px;
  }
  .card {
    width: 100%; max-width: 400px; background: var(--surface);
    border: 1px solid var(--border); border-radius: 16px; padding: 40px 32px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.08); text-align: center;
  }
  .brand { font-weight: 800; letter-spacing: .14em; font-size: 28px; color: var(--navy); }
  @media (prefers-color-scheme: dark) { .brand { color: #c9c6ff; } }
  .bar { height: 4px; width: 56px; background: var(--amber); border-radius: 2px; margin: 14px auto 0; }
  h1 { font-size: 17px; font-weight: 600; margin: 24px 0 6px; }
  p.sub { color: var(--muted); font-size: 13.5px; margin: 0 0 24px; line-height: 1.5; }
  .gbtn {
    display: inline-flex; align-items: center; justify-content: center; gap: 12px;
    width: 100%; padding: 12px 16px; font-size: 15px; font-weight: 600;
    border: 1px solid var(--border); border-radius: 10px; background: var(--surface);
    color: var(--text); cursor: pointer; text-decoration: none; transition: background .12s, border-color .12s;
  }
  .gbtn:hover { background: var(--bg); border-color: var(--muted); }
  .gbtn:focus-visible { outline: 3px solid var(--amber); outline-offset: 2px; }
  .alert {
    background: #fdecec; color: #8a1c1c; border: 1px solid #f3b9b9;
    border-radius: 10px; padding: 12px 14px; font-size: 13.5px; margin-bottom: 20px; text-align: left; line-height: 1.5;
  }
  @media (prefers-color-scheme: dark) { .alert { background: #3a1414; color: #ffb4b4; border-color: #5a1f1f; } }
  .foot { color: var(--muted); font-size: 11.5px; margin-top: 24px; line-height: 1.5; }
  @media (prefers-reduced-motion: reduce) { .gbtn { transition: none; } }
</style>
</head>
<body>
  <main class="card">
    <div class="brand">BONDLY</div>
    <div class="bar" aria-hidden="true"></div>
    <h1>Commercial Workspace</h1>
    <p class="sub">Acesso restrito à equipe. Entre com sua conta Google corporativa.</p>
    ${errorBlock}
    <a class="gbtn" href="/auth/login" rel="nofollow">
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
      Continuar com Google
    </a>
    <p class="foot">Somente contas dos domínios autorizados têm acesso.<br/>Este ambiente contém informações comerciais confidenciais.</p>
  </main>
</body>
</html>`;
}
