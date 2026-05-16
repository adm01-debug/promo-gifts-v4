import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { PageSEO } from '@/components/seo/PageSEO';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { authDebugUrl } from '@/lib/auth/auth-debug';
import { AuthFlowTracer } from '@/lib/auth/auth-flow-tracer';
import { consumePostLoginRedirect } from '@/lib/auth/post-login-redirect';

/**
 * Callback do login social via Supabase Auth.
 *
 * Suporta os 2 fluxos OAuth do Supabase:
 *  1. PKCE / Authorization Code: chega `?code=...` na URL,
 *     trocamos por sessão com `exchangeCodeForSession`.
 *  2. Implicit grant legado: chega `#access_token=...` no hash — o cliente
 *     supabase detecta automaticamente em `getSession()`.
 *
 * Todo o fluxo é instrumentado por `AuthFlowTracer`:
 *  - cada callback recebe um `flowId` curto (8 hex chars)
 *  - todos os logs no console vêm prefixados com `[AUTH-FLOW] flow=<id>`
 *  - ao final, é emitido um `console.groupCollapsed` com a timeline
 *  - um snapshot é gravado em `sessionStorage.__sso_last_flow` para
 *    inspeção posterior em `/login`
 */
export default function SSOCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshSession } = useAuth();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const tracer = new AuthFlowTracer();
    tracer.step('mount');
    authDebugUrl(`sso-callback:${tracer.flowId}`);
    tracer.step('url-parsed', {
      hasCode: searchParams.has('code'),
      hasError: searchParams.has('error'),
      hasHash: window.location.hash.length > 0,
    });

    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    if (error) {
      tracer.setProviderError(error);
      tracer.stepError('provider-error-query', { error, errorDescription });
      logger.error('[sso-callback] provider returned error', {
        flowId: tracer.flowId,
        error,
        errorDescription,
      });
      const target = '/login?error=' + encodeURIComponent(errorDescription || error);
      tracer.finish('failure', target, `provider:${error}`);
      navigate(target, { replace: true });
      return;
    }

    // Fallback no hash (?error= dentro do fragment)
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const hashParams = new URLSearchParams(hash);
    const hashError = hashParams.get('error');
    if (hashError) {
      const desc = hashParams.get('error_description') || hashError;
      tracer.setProviderError(hashError);
      tracer.stepError('provider-error-hash', { error: hashError, desc });
      logger.error('[sso-callback] hash error', { flowId: tracer.flowId, error: hashError, desc });
      const target = '/login?error=' + encodeURIComponent(desc);
      tracer.finish('failure', target, `provider-hash:${hashError}`);
      navigate(target, { replace: true });
      return;
    }

    let cancelled = false;
    let unsub: (() => void) | null = null;
    let timeoutId: number | null = null;

    const goHome = async (session?: import('@supabase/supabase-js').Session | null) => {
      if (cancelled) return;
      if (session) tracer.captureSession(session);
      try {
        await refreshSession();
      } catch (e) {
        tracer.stepError('redirect-home', e);
        logger.warn('[sso-callback] refreshSession failed', {
          flowId: tracer.flowId,
          message: e instanceof Error ? e.message : String(e),
        });
      }
      if (cancelled) return;
      const target = consumePostLoginRedirect('/');
      tracer.step('redirect-home', { target });
      tracer.finish('success', target);
      navigate(target, { replace: true });
    };

    const goLogin = (reason: string) => {
      if (cancelled) return;
      const target = '/login?error=' + encodeURIComponent(reason);
      tracer.step('redirect-login', { target, reason });
      tracer.finish('failure', target, reason);
      navigate(target, { replace: true });
    };

    const run = async () => {
      try {
        const code = searchParams.get('code');

        // (2) Fluxo PKCE — troca o code por sessão
        if (code) {
          tracer.setFlow('pkce');
          tracer.step('pkce-exchange-start', { codePrefix: code.slice(0, 6) + '…' });
          const { data: exData, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            tracer.stepError('pkce-exchange-failed', exchangeError);
            logger.error('[sso-callback] exchangeCodeForSession failed', {
              flowId: tracer.flowId,
              message: exchangeError.message,
            });
            goLogin(exchangeError.message);
            return;
          }
          tracer.captureSession(exData?.session ?? null);
          tracer.step('pkce-exchange-ok', {
            hasSession: !!exData?.session,
            provider: exData?.session?.user?.app_metadata?.provider ?? null,
          });
          await goHome(exData?.session ?? null);
          return;
        }

        // (1) e (3) Verifica se já existe sessão (broker Lovable já chamou setSession,
        // ou supabase-js já parseou o hash fragment automaticamente).
        const {
          data: { session },
        } = await supabase.auth.getSession();
        tracer.step('session-check-initial', { hasSession: !!session });
        if (session) {
          tracer.setFlow(hash ? 'implicit' : 'unknown');
          tracer.step('session-found-immediately');
          tracer.captureSession(session);
          await goHome(session);
          return;
        }

        // Caso a sessão ainda não tenha sido aplicada, escuta onAuthStateChange.
        tracer.step('auth-listener-subscribed');
        const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
          tracer.step('auth-state-change', { event, hasSession: !!newSession });
          if (newSession) {
            tracer.captureSession(newSession);
            void goHome(newSession);
          }
        });
        unsub = () => data.subscription.unsubscribe();

        // Timeout de segurança: 8s sem sessão → volta para login.
        timeoutId = window.setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: s } }) => {
            tracer.step('timeout-recheck', { hasSession: !!s });
            if (s) {
              tracer.captureSession(s);
              void goHome(s);
            } else {
              logger.warn('[sso-callback] no session after timeout', { flowId: tracer.flowId });
              goLogin('Sessão não estabelecida. Tente novamente.');
            }
          });
        }, 8000);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro inesperado';
        tracer.stepError('unexpected-error', err);
        logger.error('[sso-callback] unexpected error', { flowId: tracer.flowId, message });
        goLogin(message);
      }
    };

    run();

    return () => {
      cancelled = true;
      if (unsub) unsub();
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [navigate, searchParams, refreshSession]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <PageSEO
        title="Autenticação SSO"
        description="Processando autenticação via SSO."
        path="/auth/callback"
        noIndex
      />
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Processando autenticação...</p>
      </div>
    </div>
  );
}
