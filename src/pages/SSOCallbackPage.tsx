import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { PageSEO } from '@/components/seo/PageSEO';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { authDebugUrl } from '@/lib/auth/auth-debug';
import { AuthFlowTracer } from '@/lib/auth/auth-flow-tracer';
import { consumePostLoginRedirect } from '@/lib/auth/post-login-redirect';
import { clearOAuthPending } from '@/lib/auth/oauth-pending';
import { explainOAuthError, type OAuthErrorExplanation } from '@/lib/auth/oauth-error-explainer';

/**
 * Callback do login social via Supabase Auth.
 *
 * Suporta os 2 fluxos OAuth do Supabase:
 *  1. PKCE / Authorization Code: chega `?code=...` na URL,
 *     trocamos por sessão com `exchangeCodeForSession`.
 *  2. Implicit grant legado: chega `#access_token=...` no hash — o cliente
 *     supabase detecta automaticamente em `getSession()`.
 *
 * UI progressiva:
 *  - `processing`: aguardando troca/sessão
 *  - `slow`: passou de 3s sem sessão (mostra dica de fallback)
 *  - `confirming`: sessão capturada, atualizando contexto
 *  - `confirmed`: tudo OK, navegando para destino
 *  - `failed`: erro detectado, redirecionando para /login
 */
type CallbackStatus = 'processing' | 'slow' | 'confirming' | 'confirmed' | 'failed';

const CONFIRMED_HOLD_MS = 700;
const SLOW_HINT_MS = 3000;

export default function SSOCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshSession } = useAuth();
  const handledRef = useRef(false);
  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<OAuthErrorExplanation | null>(null);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    // A página de callback é a SSOT do estado de loading a partir daqui —
    // limpa o marcador `__oauth_pending` para que /login não restaure spinner
    // velho caso o usuário volte (e.g. via back-button durante o redirect).
    clearOAuthPending();

    const tracer = new AuthFlowTracer();
    tracer.step('mount');
    authDebugUrl(`sso-callback:${tracer.flowId}`);
    tracer.step('url-parsed', {
      hasCode: searchParams.has('code'),
      hasError: searchParams.has('error'),
      hasHash: window.location.hash.length > 0,
    });

    // Slow-hint timer: se em 3s ainda estivermos em "processing", troca para "slow"
    const slowHintId = window.setTimeout(() => {
      setStatus((prev) => (prev === 'processing' ? 'slow' : prev));
    }, SLOW_HINT_MS);

    const buildLoginTarget = (detail: OAuthErrorExplanation): string => {
      const params = new URLSearchParams();
      params.set('error', detail.code);
      params.set('error_description', detail.description);
      params.set('hint', detail.hint);
      return `/login?${params.toString()}`;
    };

    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    if (error) {
      const detail = explainOAuthError({ error, description: errorDescription });
      tracer.setProviderError(error);
      tracer.stepError('provider-error-query', { error, errorDescription, code: detail.code });
      logger.error('[sso-callback] provider returned error', {
        flowId: tracer.flowId,
        error,
        errorDescription,
        code: detail.code,
        severity: detail.severity,
      });
      setStatus('failed');
      setErrorMessage(detail.description);
      setErrorDetail(detail);
      const target = buildLoginTarget(detail);
      tracer.finish('failure', target, `provider:${detail.code}`);
      window.clearTimeout(slowHintId);
      navigate(target, { replace: true });
      return;
    }

    // Fallback no hash (?error= dentro do fragment)
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const hashParams = new URLSearchParams(hash);
    const hashError = hashParams.get('error');
    if (hashError) {
      const desc = hashParams.get('error_description');
      const detail = explainOAuthError({ error: hashError, description: desc });
      tracer.setProviderError(hashError);
      tracer.stepError('provider-error-hash', { error: hashError, desc, code: detail.code });
      logger.error('[sso-callback] hash error', {
        flowId: tracer.flowId,
        error: hashError,
        desc,
        code: detail.code,
        severity: detail.severity,
      });
      setStatus('failed');
      setErrorMessage(detail.description);
      setErrorDetail(detail);
      const target = buildLoginTarget(detail);
      tracer.finish('failure', target, `provider-hash:${detail.code}`);
      window.clearTimeout(slowHintId);
      navigate(target, { replace: true });
      return;
    }

    let cancelled = false;
    let unsub: (() => void) | null = null;
    let timeoutId: number | null = null;
    let confirmedHoldId: number | null = null;

    const goHome = async (session?: import('@supabase/supabase-js').Session | null) => {
      if (cancelled) return;
      if (session) tracer.captureSession(session);
      // Status: sessão capturada, atualizando contexto local
      setStatus('confirming');
      if (session?.user?.email) setUserEmail(session.user.email);
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
      // Mostra "confirmado" por um instante antes de navegar
      setStatus('confirmed');
      window.clearTimeout(slowHintId);
      confirmedHoldId = window.setTimeout(() => {
        if (!cancelled) navigate(target, { replace: true });
      }, CONFIRMED_HOLD_MS);
    };

    const goLogin = (reason: string, rawCode?: string) => {
      if (cancelled) return;
      const detail = explainOAuthError({ error: rawCode ?? null, description: reason });
      setStatus('failed');
      setErrorMessage(detail.description);
      setErrorDetail(detail);
      const target = buildLoginTarget(detail);
      tracer.step('redirect-login', { target, reason, code: detail.code });
      tracer.finish('failure', target, `${detail.code}:${reason}`);
      window.clearTimeout(slowHintId);
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
      if (confirmedHoldId !== null) window.clearTimeout(confirmedHoldId);
      window.clearTimeout(slowHintId);
    };
  }, [navigate, searchParams, refreshSession]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <PageSEO
        title="Autenticação SSO"
        description="Processando autenticação via SSO."
        path="/auth/callback"
        noIndex
      />
      <div
        role="status"
        aria-live="polite"
        aria-busy={status !== 'confirmed' && status !== 'failed'}
        className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border/60 bg-card/60 p-8 text-center shadow-sm"
        data-status={status}
      >
        <StatusIcon status={status} />
        <div className="space-y-1">
          <h1 className="text-base font-semibold text-foreground" data-testid="sso-callback-title">
            {status === 'failed' && errorDetail ? errorDetail.title : STATUS_TITLE[status]}
          </h1>
          <p className="text-sm text-muted-foreground" data-testid="sso-callback-description">
            {status === 'failed' && errorMessage
              ? errorMessage
              : STATUS_DESCRIPTION[status]}
          </p>
          {(status === 'confirming' || status === 'confirmed') && userEmail && (
            <p className="pt-1 text-xs text-muted-foreground/80">
              {userEmail}
            </p>
          )}
        </div>
        {status === 'failed' && errorDetail && (
          <div
            className={
              'w-full rounded-lg border px-3 py-2 text-left text-xs ' +
              SEVERITY_STYLES[errorDetail.severity]
            }
            data-testid="sso-callback-hint"
            data-severity={errorDetail.severity}
            data-error-code={errorDetail.code}
          >
            <p className="font-medium">Como resolver</p>
            <p className="mt-1 text-muted-foreground">{errorDetail.hint}</p>
            <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground/60">
              Código: {errorDetail.code}
            </p>
          </div>
        )}
        <StatusSteps status={status} />
      </div>
    </div>
  );
}

const STATUS_TITLE: Record<CallbackStatus, string> = {
  processing: 'Processando autenticação',
  slow: 'Ainda processando...',
  confirming: 'Sessão recebida',
  confirmed: 'Tudo certo!',
  failed: 'Falha na autenticação',
};

const STATUS_DESCRIPTION: Record<CallbackStatus, string> = {
  processing: 'Validando credenciais do provedor.',
  slow: 'A resposta está demorando mais do que o esperado. Aguarde alguns segundos antes de tentar novamente.',
  confirming: 'Atualizando sua sessão local...',
  confirmed: 'Redirecionando você para o app.',
  failed: 'Não foi possível completar o login.',
};

const SEVERITY_STYLES: Record<OAuthErrorExplanation['severity'], string> = {
  config: 'border-destructive/40 bg-destructive/5',
  user: 'border-amber-500/40 bg-amber-500/5',
  transient: 'border-primary/30 bg-primary/5',
  unknown: 'border-border bg-muted/40',
};

function StatusIcon({ status }: { status: CallbackStatus }) {
  if (status === 'confirmed') {
    return <CheckCircle2 className="h-10 w-10 text-primary animate-fade-in" />;
  }
  if (status === 'failed') {
    return <AlertCircle className="h-10 w-10 text-destructive" />;
  }
  return <Loader2 className="h-10 w-10 animate-spin text-primary" />;
}

function StatusSteps({ status }: { status: CallbackStatus }) {
  const steps: { key: CallbackStatus; label: string }[] = [
    { key: 'processing', label: 'Recebendo' },
    { key: 'confirming', label: 'Atualizando' },
    { key: 'confirmed', label: 'Pronto' },
  ];
  const order: CallbackStatus[] = ['processing', 'slow', 'confirming', 'confirmed'];
  const currentIdx = order.indexOf(status);
  return (
    <ol className="flex w-full items-center justify-between gap-2 pt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
      {steps.map((s) => {
        const stepIdx = order.indexOf(s.key);
        const done = status === 'failed' ? false : currentIdx >= stepIdx;
        const active = status === s.key || (s.key === 'processing' && status === 'slow');
        return (
          <li
            key={s.key}
            className={
              'flex flex-1 flex-col items-center gap-1 ' +
              (done ? 'text-foreground' : '')
            }
          >
            <span
              className={
                'h-1 w-full rounded-full transition-colors ' +
                (done ? 'bg-primary' : 'bg-muted')
              }
              aria-current={active ? 'step' : undefined}
            />
            <span>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
