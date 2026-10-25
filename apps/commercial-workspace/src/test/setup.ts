import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Limpa o DOM e o localStorage entre testes (o workspace persiste estado em localStorage).
afterEach(() => {
  cleanup();
  localStorage.clear();
});
