import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setupUpdates } from './state/appUpdate';
import { installLive } from './state/live';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';

const { updatedFrom } = setupUpdates();
installLive();
try { void navigator.storage?.persist?.(); } catch { /* 무시 */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><App updatedFrom={updatedFrom} /></ErrorBoundary>
  </StrictMode>,
);
