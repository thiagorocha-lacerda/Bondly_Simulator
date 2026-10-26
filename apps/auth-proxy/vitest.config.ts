import { defineConfig } from 'vitest/config';

// root fixado neste pacote: evita o vitest subir e carregar um vite.config.ts de diretório pai.
export default defineConfig({
  root: __dirname,
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
