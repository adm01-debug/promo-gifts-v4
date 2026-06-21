import './lib/console-filter';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { registerServiceWorker } from '@/lib/sw-register';
import { installGlobalErrorHandlers } from '@/lib/error-reporter';
import { initSentry } from '@/lib/sentry';
import { installSafeToast } from '@/lib/security/safeToast';
import { validateSupabaseConfig } from '@/integrations/supabase/runtime-validator';
import EnhancedErrorBoundary from '@/components/errors/EnhancedErrorBoundary';
import App from './App.tsx';
import './index.css';
import './styles/brand-tokens.css';
import './styles/missing-root-tokens.css';
import './styles/diversity-overrides.css';

validateSupabaseConfig();
initSentry();
installGlobalErrorHandlers();
installSafeToast();

// ── Core Web Vitals monitoring (dev only) ─────────────────────────────────────
if (import.meta.env.DEV) {
  import('@/utils/performance-budget').then(({ initPerformanceBudget }) => {
    initPerformanceBudget();
  });
}

// ── Vite chunk-load recovery ─────────────────────────────────────────────────
// When Vercel deploys a new build, old chunk hashes are invalidated.
// Any user who has the app open will fail to lazy-load those stale chunks.
// `vite:preloadError` fires before React can catch it — we reload here
// so the user silently gets the latest version instead of a blank screen.
//
// Cooldown (10 s) prevents infinite-reload loops caused by genuine 404s.
const _CHUNK_RELOAD_KEY = '__vite_chunk_reload';
window.addEventListener('vite:preloadError', () => {
  const last = sessionStorage.getItem(_CHUNK_RELOAD_KEY);
  const now = Date.now();
  if (!last || now - parseInt(last, 10) > 10_000) {
    sessionStorage.setItem(_CHUNK_RELOAD_KEY, String(now));
    window.location.reload();
  }
});
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('root');

if (!root) {
  throw new Error('Elemento root nao encontrado no DOM');
}

createRoot(root).render(
  <>
    <HelmetProvider>
      <EnhancedErrorBoundary>
        <App />
      </EnhancedErrorBoundary>
    </HelmetProvider>
  </>,
);

if (import.meta.env.PROD) {
  registerServiceWorker();
}
