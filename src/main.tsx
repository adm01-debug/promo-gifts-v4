import { Fragment, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
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

function Root() {
  useEffect(() => {
    // -------------------------------------------------------------------------
    // SIMULAÇÃO DE LATÊNCIA E ERRO (DESATIVAR ANTES DE PROD)
    // -------------------------------------------------------------------------
    const originalInvoke = supabase.functions.invoke;
    supabase.functions.invoke = async function (functionName: string, options?: any) {
      console.log(`[Simulation] Intercepting call to edge function: ${functionName}`);
      
      // Simulate latency (3 seconds)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Simulate random error (20% chance)
      if (Math.random() < 0.2) {
        console.error("[Simulation] Injecting artificial API error!");
        return { data: null, error: { message: "Artificial latency/error simulation active", status: 500 } as any };
      }
      
      return originalInvoke.apply(this, [functionName, options]);
    };
    // -------------------------------------------------------------------------
  }, []);

  return (
    <Fragment>
      <HelmetProvider>
        <EnhancedErrorBoundary>
          <App />
        </EnhancedErrorBoundary>
      </HelmetProvider>
    </Fragment>
  );
}

// O overlay BridgeMetrics agora é montado DENTRO do <App /> (após o
// AuthProvider) para poder ser gateado por papel `dev` + SSOT
// `shouldShowDevInfraMessages`. Em build de produção, o componente
// retorna null no topo e o chunk é tree-shaken pelo bundler.
createRoot(root).render(<Root />);

// Register Service Worker for PWA support
// Performance Note: This enables caching and offline support
if (import.meta.env.PROD) {
  registerServiceWorker();
}
