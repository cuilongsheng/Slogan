import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppProviders } from './app/providers/AppProviders';
import { AppRouter } from './app/router/AppRouter';
import './styles/index.css';
import { adminReactErrorHandlers } from './app/observability';

const rootElement = document.querySelector('#root');

if (!rootElement) {
  throw new Error('Admin root element was not found.');
}

createRoot(rootElement, adminReactErrorHandlers).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
);
