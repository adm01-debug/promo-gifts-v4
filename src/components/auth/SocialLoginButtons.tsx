import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useState, useEffect, useRef, forwardRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { authDebug, authDebugError } from '@/lib/auth/auth-debug';
import {
  markOAuthPending,
  clearOAuthPending,
  readOAuthPending,
} from '@/lib/auth/oauth-pending';

/** Mapeia erros conhecidos do Supabase OAuth para mensagens PT-BR amigáveis. */
function mapOAuthError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('unsupported provider') || m.includes('provider is not enabled')) {
    return 'provider_is_not_enabled';
  }
  if (m.includes('redirect') && m.includes('not allowed')) {
    return 'URL de retorno não autorizada. Verifique a configuração do provedor.';
  }
  if (m.includes('network') || m.includes('failed to fetch')) {
    return 'Sem conexão com o servidor de autenticação. Verifique sua internet e tente novamente.';
  }
  if (m.includes('popup') && m.includes('closed')) {
    return 'Janela do Google fechada antes de concluir o login.';
  }
  return raw || 'Falha ao iniciar login com Google.';
}

/** Tempo (ms) até avisar o usuário que o redirect está demorando. */
const SLOW_REDIRECT_MS = 6000;
/** Tempo (ms) até considerar que o redirect falhou silenciosamente. */
const REDIRECT_TIMEOUT_MS = 15000;

interface SocialLoginButtonsProps {
  /**
   * Disparado quando o login social falha — habilita fallback para e-mail/senha.
   * `opts.autoFallback`: true quando a falha foi por timeout/silencioso, indicando
   * que o pai deve automaticamente focar o formulário de e-mail (sem exigir clique).
   */
  onError?: (message: string, opts?: { autoFallback?: boolean }) => void;
  /**
   * Ref mutável onde o componente publica a função `retry()`.
   * Permite que o pai (banner de erro) reexecute o fluxo Google sem
   * o usuário precisar rolar até o botão original.
   */
  retryRef?: React.MutableRefObject<(() => void) | null>;
}

/**
 * Botões de login social. Atualmente: somente Google via Supabase Auth nativo.
 *
 * Antes desta refatoração, o componente tinha um broker Lovable Cloud
 * (@lovable.dev/cloud-auth-js) ativado em domínios Lovable e Supabase
 * direto em domínios self-hosted. Como saímos do Lovable Cloud, agora
 * usamos sempre Supabase Auth direto.
 *
 * Para reativar o SSO antes do deploy, ver `docs/AUTH-SSO-ACTIVATION.md`.
 */
export const SocialLoginButtons = forwardRef<HTMLDivElement, SocialLoginButtonsProps>(
  function SocialLoginButtons({ onError, retryRef }, ref) {
    const [isLoading, setIsLoading] = useState<string | null>(null);
    const [slowHint, setSlowHint] = useState<string | null>(null);
    const { toast } = useToast();
    const slowTimerRef = useRef<number | null>(null);
    const failTimerRef = useRef<number | null>(null);

    const clearTimers = () => {
      if (slowTimerRef.current !== null) {
        window.clearTimeout(slowTimerRef.current);
        slowTimerRef.current = null;
      }
      if (failTimerRef.current !== null) {
        window.clearTimeout(failTimerRef.current);
        failTimerRef.current = null;
      }
    };

    // Limpa timers no unmount
    useEffect(() => () => clearTimers(), []);

    // Restaura o spinner se o usuário voltou de /auth/callback (ou cancelou)
    // enquanto um fluxo OAuth ainda estava marcado como pendente. Evita
    // o flash do botão idle antes do AuthContext reconciliar.
    useEffect(() => {
      const pending = readOAuthPending();
      if (pending) {
        setIsLoading(pending.provider);
        // Reagenda o timeout duro com o tempo restante.
        const elapsed = Date.now() - pending.startedAt;
        const remaining = Math.max(1000, REDIRECT_TIMEOUT_MS - elapsed);
        failTimerRef.current = window.setTimeout(() => {
          authDebugError('social-login', 'pending timeout on remount', { remaining });
          finishWithError(
            'Tempo esgotado ao contatar o Google. Verifique sua conexão e tente novamente.',
            { autoFallback: true },
          );
        }, remaining);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Se a aba ficar oculta (redirect iniciou), libera o spinner ao voltar.
    useEffect(() => {
      const onVis = () => {
        if (document.visibilityState === 'visible' && isLoading) {
          // Se voltou rápido (sem callback intermediário) e ainda há pending,
          // assumimos que o usuário cancelou — limpa o marcador.
          clearOAuthPending();
          setIsLoading(null);
          setSlowHint(null);
          clearTimers();
        }
      };
      document.addEventListener('visibilitychange', onVis);
      return () => document.removeEventListener('visibilitychange', onVis);
    }, [isLoading]);

    const finishWithError = (msg: string, opts?: { autoFallback?: boolean }) => {
      clearTimers();
      clearOAuthPending();
      setIsLoading(null);
      setSlowHint(null);
      toast({ variant: 'destructive', title: 'Erro ao entrar com Google', description: msg });
      onError?.(msg, opts);
    };

    const handleGoogleLogin = async () => {
      setIsLoading('google');
      setSlowHint(null);
      // Marca pending ANTES do redirect para que ao voltar (callback ou cancelo)
      // o componente reidrate com spinner sem flash do botão idle.
      markOAuthPending('google');
      const redirect_uri = `${window.location.origin}/auth/callback`;
      authDebug('social-login', 'google click', { redirect_uri, origin: window.location.origin });

      // Aviso de lentidão
      slowTimerRef.current = window.setTimeout(() => {
        setSlowHint('Conectando ao Google… isto pode levar alguns segundos.');
      }, SLOW_REDIRECT_MS);

      // Timeout duro: se nada acontecer, assume falha silenciosa
      // e sinaliza autoFallback=true para que o pai foque o form de e-mail.
      failTimerRef.current = window.setTimeout(() => {
        authDebugError('social-login', 'redirect timeout', { ms: REDIRECT_TIMEOUT_MS });
        finishWithError(
          'Tempo esgotado ao contatar o Google. Verifique sua conexão e tente novamente.',
          { autoFallback: true },
        );
      }, REDIRECT_TIMEOUT_MS);

      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: redirect_uri },
        });
        if (error) {
          authDebugError('social-login', 'supabase.signInWithOAuth returned error', error);
          finishWithError(mapOAuthError(error.message));
          return;
        }
        authDebug('social-login', 'redirect dispatched via Supabase OAuth');
        // Sucesso: o navegador deve redirecionar. Timers serão limpos pelo unmount/visibilitychange.
      } catch (err) {
        authDebugError('social-login', 'unexpected exception during OAuth', err);
        const raw = err instanceof Error ? err.message : 'Tente novamente mais tarde';
        finishWithError(mapOAuthError(raw));
      }
    };

    // Publica a função `retry()` no ref do pai (banner de erro).
    useEffect(() => {
      if (!retryRef) return;
      retryRef.current = () => {
        if (isLoading) return;
        void handleGoogleLogin();
      };
      return () => {
        if (retryRef) retryRef.current = null;
      };
    });

    const loading = isLoading === 'google';

    return (
      <div ref={ref} className="space-y-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full gap-3 border-border/60 font-medium transition-all hover:border-border hover:bg-muted/50"
          onClick={handleGoogleLogin}
          disabled={!!isLoading}
          aria-busy={loading}
          data-testid="social-login-google"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          {loading ? 'Conectando ao Google…' : 'Continuar com Google'}
        </Button>
        {slowHint && loading && (
          <p
            className="text-center text-xs text-muted-foreground animate-fade-in"
            role="status"
            aria-live="polite"
          >
            {slowHint}
          </p>
        )}
      </div>
    );
  },
);
