import { useEffect, useState } from 'react';

/**
 * Identidade da sessão atual, lida do BFF em /api/me (§6). O frontend NÃO decide autorização —
 * quem entrega esta página já passou pelo proxy de borda. Isto é só para exibir nome/e-mail/foto
 * e o botão Sair. Em dev sem o proxy (Vite puro), /api/me responde 401/HTML e caímos em `null`,
 * então a UI simplesmente não mostra a barra de usuário — sem quebrar o simulador.
 */
export interface SessionUser {
  readonly email: string;
  readonly name: string | null;
  readonly picture: string | null;
  readonly domain: string;
}

export function useSession(): { user: SessionUser | null; loading: boolean } {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch('/api/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(async (r) => {
        if (!alive) return;
        if (!r.ok) {
          setUser(null);
          return;
        }
        const ct = r.headers.get('content-type') ?? '';
        if (!ct.includes('application/json')) {
          setUser(null);
          return;
        }
        setUser((await r.json()) as SessionUser);
      })
      .catch(() => {
        if (alive) setUser(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { user, loading };
}
