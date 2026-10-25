import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Testes de UI rodam em jsdom (Testing Library). Os testes de lógica financeira vivem no
// pacote @bondly/pricing-engine; aqui cobrimos apenas comportamento de componente (ex.: §12/§16
// — a pré-visualização não pode expor números internos em visão comercial).
// Resolve o engine pela sua FONTE TS (mesmo alias do vite.config), evitando depender de dist/.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@bondly/pricing-engine': fileURLToPath(
        new URL('../../packages/pricing-engine/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
