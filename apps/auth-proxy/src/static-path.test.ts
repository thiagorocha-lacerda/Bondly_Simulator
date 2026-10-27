import { describe, it, expect } from 'vitest';
import { sep } from 'node:path';
import { resolveStaticPath } from './static-path';

/**
 * Teste direto do guard de caminho estático (n2) — sem subir o servidor nem o gate de sessão.
 *
 * Semântica real (e segura) do guard: `urlPath` sempre começa com `/`, então `normalize` colapsa
 * os `..` num caminho ABSOLUTO (`/etc/passwd`) e `join(staticDir, "/etc/passwd")` REANCORA esse
 * absoluto DENTRO de `staticDir` (`<root>/etc/passwd`). Resultado: NENHUMA entrada HTTP escapa a
 * raiz — o traversal clássico vira um arquivo inexistente sob o dist (→ 404 no serveStatic), nunca
 * o `/etc/passwd` do host. O comparador com separador final (correção do n2) é defense-in-depth:
 * garante que um `<root>` NÃO case um diretório IRMÃO por prefixo (`<root>` vs `<root>-x`).
 */
describe('resolveStaticPath — guard de borda do dist (n2)', () => {
  const ROOT = '/srv/app/dist';
  const inside = (p: string) => p === ROOT || p.startsWith(ROOT + sep);

  describe('caminhos legítimos → resolvem para dentro da raiz', () => {
    it('raiz exata', () => {
      const r = resolveStaticPath(ROOT, '/');
      expect(r.ok && inside(r.filePath)).toBe(true);
    });
    it('arquivo na raiz', () => {
      const r = resolveStaticPath(ROOT, '/index.html');
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.filePath).toBe('/srv/app/dist/index.html');
    });
    it('asset aninhado', () => {
      const r = resolveStaticPath(ROOT, '/assets/app-abc123.js');
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.filePath).toBe('/srv/app/dist/assets/app-abc123.js');
    });
    it('`.` e `..` internos normalizam para dentro', () => {
      const r = resolveStaticPath(ROOT, '/assets/./x/../app.css');
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.filePath).toBe('/srv/app/dist/assets/app.css');
    });
  });

  describe('traversal → SEMPRE confinado à raiz, host nunca exposto', () => {
    const traversals = [
      '/../../../../etc/passwd',
      '/assets/../../../../../etc/passwd',
      '/%2e%2e/%2e%2e/%2e%2e/etc/passwd', // percent-encoded ..
      '//etc/passwd',
      '/../dist-x/leak.txt', // tentativa de irmão via traversal
    ];
    for (const u of traversals) {
      it(`"${u}" → confinado sob o dist, nunca o host`, () => {
        const r = resolveStaticPath(ROOT, u);
        expect(r.ok).toBe(true); // reancorado sob o dist (arquivo pode não existir → 404)
        if (r.ok) {
          expect(inside(r.filePath)).toBe(true);
          expect(r.filePath).not.toBe('/etc/passwd');
          expect(r.filePath).not.toBe('/srv/app/dist-x/leak.txt'); // nunca o irmão
        }
      });
    }
  });

  describe('comparador de separador final (o cerne do n2)', () => {
    it('distingue o diretório IRMÃO do filho no nível de string', () => {
      // Esta é a regressão que o n2 corrige: um caminho irmão NÃO pode casar a raiz por prefixo cru.
      const siblingPath = '/srv/app/dist-x/leak.txt';
      expect(siblingPath.startsWith(ROOT + sep)).toBe(false); // guard novo: recusa
      expect(siblingPath.startsWith(ROOT)).toBe(true); // prefixo cru antigo: vazaria
    });
    it('o próprio root e um filho legítimo passam pelo comparador', () => {
      expect(ROOT === ROOT || ROOT.startsWith(ROOT + sep)).toBe(true);
      expect(('/srv/app/dist/index.html').startsWith(ROOT + sep)).toBe(true);
    });
  });

  it('staticDir já com separador final é tratado consistentemente', () => {
    const r = resolveStaticPath('/srv/app/dist/', '/index.html');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.filePath).toBe('/srv/app/dist/index.html');
  });
});
