import './lib/console-filter';
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
// BUG-02/03/09/14 fix: tokens CSS ausentes do :root em index.css
// @see docs/design-system-audit-2026-05-25.md
import './styles/missing-root-tokens.css';

// Initialize Sentry FIRST (no-op if VITE_SENTRY_DSN is unset)
initSentry();



// Install global error handlers for unhandled errors/rejections
installGlobalErrorHandlers();

// Patch global de `sonner` — bloqueia mensagens técnicas em toasts para não-dev.
// Idempotente; respeita o Dev Infra Messages Gate.
installSafeToast();

const root = document.getElementById('root');

if (!root) {
  throw new Error('❌ Elemento root não encontrado no DOM');
}

// O overlay BridgeMetrics agora é montado DENTRO do <App /> (após o
// AuthProvider) para poder ser gateado por papel `dev` + SSOT
// `shouldShowDevInfraMessages`. Em build de produção, o componente
// retorna null no topo e o chunk é tree-shaken pelo bundler.
createRoot(root).render(
  <Fragment>
    <HelmetProvider>
      <EnhancedErrorBoundary>
        <App />
      </EnhancedErrorBoundary>
    </HelmetProvider>
  </Fragment>,
);

// Register Service Worker for PWA support
// Performance Note: This enables caching and offline support
if (import.meta.env.PROD) {
  registerServiceWorker();
}
