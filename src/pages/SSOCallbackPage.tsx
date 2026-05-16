import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { PageSEO } from '@/components/seo/PageSEO';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { authDebug, authDebugError, authDebugUrl, summarizeSession } from '@/lib/auth/auth-debug';
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
 * Se a sessão ainda não estiver aplicada, escuta `onAuthStateChange` e
 * tem timeout de segurança de 8s pra evitar loop.
 */
export default function SSOCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshSession } = useAuth();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    authDebug('sso-callback', 'mount');
    authDebugUrl('sso-callback');

    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    if (error) {
      authDebugError('sso-callback', 'provider returned error in query', {
        error,
        errorDescription,
      });
      logger.error('[sso-callback] provider returned error', { error, errorDescription });
      navigate('/login?error=' + encodeURIComponent(errorDescription || error), { replace: true });
      return;
    }

    // Fallback no hash (?error= dentro do fragment)
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const hashParams = new URLSearchParams(hash);
    const hashError = hashParams.get('error');
    if (hashError) {
      const desc = hashParams.get('error_description') || hashError;
      authDebugError('sso-callback', 'provider returned error in hash', { error: hashError, desc });
      logger.error('[sso-callback] hash error', { error: hashError, desc });
      navigate('/login?error=' + encodeURIComponent(desc), { replace: true });
      return;
    }

    let cancelled = false;
    let unsub: (() => void) | null = null;
    let timeoutId: number | null = null;

    const goHome = async () => {
      if (cancelled) return;
      authDebug('sso-callback', 'goHome — calling refreshSession()');
      try {
        await refreshSession();
        authDebug('sso-callback', 'refreshSession ok, navigating to /');
      } catch (e) {
        authDebugError('sso-callback', 'refreshSession failed', e);
        logger.warn('[sso-callback] refreshSession failed', {
          message: e instanceof Error ? e.message : String(e),
        });
      }
      if (cancelled) return;
      navigate('/', { replace: true });
    };

    const goLogin = (reason: string) => {
      if (cancelled) return;
      authDebug('sso-callback', 'goLogin', { reason });
      navigate('/login?error=' + encodeURIComponent(reason), { replace: true });
    };

    const run = async () => {
      try {
        const code = searchParams.get('code');

        // (2) Fluxo PKCE — troca o code por sessão
        if (code) {
          authDebug('sso-callback', 'PKCE flow: exchangeCodeForSession start');
          const { data: exData, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            authDebugError('sso-callback', 'exchangeCodeForSession failed', exchangeError);
            logger.error('[sso-callback] exchangeCodeForSession failed', {
              message: exchangeError.message,
            });
            goLogin(exchangeError.message);
            return;
          }
          authDebug(
            'sso-callback',
            'exchangeCodeForSession ok',
            summarizeSession(exData?.session ?? null),
          );
          await goHome();
          return;
        }

        // (1) e (3) Verifica se já existe sessão (broker Lovable já chamou setSession,
        // ou supabase-js já parseou o hash fragment automaticamente).
        const {
          data: { session },
        } = await supabase.auth.getSession();
        authDebug('sso-callback', 'initial getSession()', summarizeSession(session));
        if (session) {
          await goHome();
          return;
        }

        // Caso a sessão ainda não tenha sido aplicada, escuta onAuthStateChange.
        authDebug('sso-callback', 'no session yet — subscribing to onAuthStateChange');
        const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
          authDebug(
            'sso-callback',
            `onAuthStateChange event=${event}`,
            summarizeSession(newSession),
          );
          if (newSession) {
            void goHome();
          }
        });
        unsub = () => data.subscription.unsubscribe();

        // Timeout de segurança: 8s sem sessão → volta para login.
        timeoutId = window.setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: s } }) => {
            authDebug('sso-callback', 'timeout 8s — re-checking session', summarizeSession(s));
            if (s) {
              void goHome();
            } else {
              logger.warn('[sso-callback] no session after timeout');
              goLogin('Sessão não estabelecida. Tente novamente.');
            }
          });
        }, 8000);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro inesperado';
        authDebugError('sso-callback', 'unexpected error in run()', err);
        logger.error('[sso-callback] unexpected error', { message });
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
