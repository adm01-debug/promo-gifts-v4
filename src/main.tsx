import './lib/console-filter';
// Bridge interceptor: patches supabase.functions.invoke to route
// external-db-bridge calls through REST native. Must be imported
// BEFORE any React component renders.
import './lib/external-db/bridge-interceptor';
import { Fragment } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { registerServiceWorker } from '@/lib/sw-register';
import { installGlobalErrorHandlers } from '@/lib/error-reporter';
import { initSentry } from '@/lib/sentry';
import { installSafeToast } from '@/lib/security/safeToast';
import EnhancedErrorBoundary from '@/components/errors/EnhancedErrorBoundary';
import App from './App.tsx';
import './index.css';
import './styles/brand-tokens.css';
import './styles/missing-root-tokens.css';

initSentry();
installGlobalErrorHandlers();
installSafeToast();

const root = document.getElementById('root');

if (!root) {
  throw new Error('Elemento root nao encontrado no DOM');
}

createRoot(root).render(
  <Fragment>
    <HelmetProvider>
      <EnhancedErrorBoundary>
        <App />
      </EnhancedErrorBoundary>
    </HelmetProvider>
  </Fragment>,
);

if (import.meta.env.PROD) {
  registerServiceWorker();
}
