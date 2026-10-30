import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AudienceProvider } from './app/audience';
import { PreviewGate } from './app/PreviewGate';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root não encontrado');
createRoot(root).render(
  <StrictMode>
    <PreviewGate>
      <AudienceProvider>
        <App />
      </AudienceProvider>
    </PreviewGate>
  </StrictMode>,
);
