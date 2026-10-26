import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// useSession chama GET /api/me no mount. Em teste não há BFF: respondemos 401 (sem sessão),
// que é o caminho em que a barra de usuário simplesmente não aparece — sem quebrar o simulador.
if (!('fetch' in globalThis) || true) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify({ error: 'unauthenticated' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
}

// Limpa o DOM e o localStorage entre testes (o workspace persiste estado em localStorage).
afterEach(() => {
  cleanup();
  localStorage.clear();
});
