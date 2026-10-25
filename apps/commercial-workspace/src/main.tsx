import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AudienceProvider } from './app/audience';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root não encontrado');
createRoot(root).render(
  <StrictMode>
    <AudienceProvider>
      <App />
    </AudienceProvider>
  </StrictMode>,
);
