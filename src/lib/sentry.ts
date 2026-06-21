/**
 * Sentry initialization — LAZY LOADED.
 *
 * O bundle do Sentry (~186KB) NÃO entra no chunk inicial. Carregamos via
 * `import()` dinâmico após `requestIdleCallback` (ou 3s de fallback) para
 * priorizar o First Contentful Paint.
 *
 * Erros disparados antes do load são bufferizados e dispensados no flush.
 */
import type * as SentryNS from '@sentry/react';

import { logger } from '@/lib/logger';
type SentryModule = typeof SentryNS;

let sentryRef: SentryModule | null = null;
let initialized = false;
let loadingPromise: Promise<SentryModule | null> | null = null;

interface BufferedError {
  error: Error;
  context?: Record<string, unknown>;
}
const ERROR_BUFFER: BufferedError[] = [];
let bufferedUser: { id: string; email?: string } | null | undefined;
const BUFFER_MAX = 50;

/**
 * Valida o formato do DSN do Sentry/GlitchTip.
 *
 * Formato esperado: protocol://<public_key>[:<secret_key>]@<host>[:<port>]/<project_id>
 *
 * IMPORTANTE: o parser do `@sentry/utils` (parseDsn) usa `\w` que NÃO aceita
 * hífens no public_key. Se o GlitchTip gerou um DSN com UUID (ex.:
 * `https://66323199-858e-4295-...@host/4`), o SDK rejeita e loga
 * "Invalid Sentry Dsn" no console do usuário.
 *
 * Workaround: validamos aqui ANTES de chamar `mod.init()` e fazemos no-op
 * silencioso se o DSN estiver malformado, evitando poluir o console em prod
 * sem quebrar o build. Em dev, loga warning para alertar o time.
 *
 * Para gerar um DSN compatível no GlitchTip, regenere a Client Key do projeto
 * — versões recentes do GlitchTip emitem chaves alfanuméricas (sem hífens)
 * compatíveis com o SDK Sentry 8.x.
 */
function isValidSentryDsn(dsn: string | undefined): dsn is string {
  if (!dsn) return false;
  // Regex compatível com o parser do @sentry/utils:
  // protocol://public_key[:secret_key]@host[:port]/project_id
  // \w = [A-Za-z0-9_] — não aceita hífens (UUIDs falham aqui).
  const SENTRY_DSN_REGEX = /^(?:(\w+):)\/\/(?:(\w+)(?::(\w+))?@)([\w.-]+)(?::(\d+))?\/(.+)/;
  return SENTRY_DSN_REGEX.test(dsn);
}

function shouldLoadSentry(): boolean {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return false;
  if (!isValidSentryDsn(dsn)) {
    if (import.meta.env.DEV) {
      logger.warn(
        '[sentry] VITE_SENTRY_DSN tem formato inválido — Sentry não será inicializado. ' +
          'Formato esperado: https://<public_key>@<host>/<project_id> ' +
          '(public_key sem hífens — UUIDs do GlitchTip não são compatíveis com SDK Sentry 8.x). ' +
          'Regenere a Client Key no GlitchTip para obter uma chave alfanumérica compatível.',
      );
    }
    return false;
  }
  return true;
}

async function loadSentry(): Promise<SentryModule | null> {
  if (sentryRef) return sentryRef;
  if (loadingPromise) return loadingPromise;
  if (!shouldLoadSentry()) return null;

  loadingPromise = (async () => {
    try {
      const mod = await import('@sentry/react');
      sentryRef = mod;

      const dsn = import.meta.env.VITE_SENTRY_DSN as string;
      mod.init({
        dsn,
        environment:
          (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) || import.meta.env.MODE,
        // Release tag = commit SHA do Vercel — permite associar erro ao deploy
        release: (import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA as string | undefined) || undefined,
        tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
        replaysSessionSampleRate: 0,
        // Onda 5: aprovado por Joaquim — replay 100% quando dá erro
        replaysOnErrorSampleRate: import.meta.env.PROD ? 1.0 : 0,
        integrations: [
          mod.browserTracingIntegration(),
          // LGPD: mascarar todo texto + inputs, não enviar imagens/vídeos
          mod.replayIntegration({
            maskAllText: true,
            maskAllInputs: true,
            blockAllMedia: true,
          }),
          // Onda 5: captura console.error automaticamente
          // (logger.error → console.error → GlitchTip)
          mod.captureConsoleIntegration({ levels: ['error'] }),
        ],
        // Onda 5: ignorar ruído conhecido (não-bug nosso)
        ignoreErrors: [
          // Browser/extension noise
          'ResizeObserver loop limit exceeded',
          'ResizeObserver loop completed with undelivered notifications',
          'Non-Error promise rejection captured',
          // Network noise (oscilação de conexão dos vendedores)
          'Failed to fetch',
          'NetworkError when attempting to fetch resource',
          'Load failed',
          // Extension noise
          /extension:\/\//,
          /moz-extension:\/\//,
        ],
        beforeSend(event) {
          if (event.request?.headers) {
            delete (event.request.headers as Record<string, unknown>).authorization;
            delete (event.request.headers as Record<string, unknown>).cookie;
          }
          return event;
        },
      });
      initialized = true;

      // Flush user e buffer
      if (bufferedUser !== undefined) {
        mod.setUser(bufferedUser);
      }
      while (ERROR_BUFFER.length) {
        const item = ERROR_BUFFER.shift();
        if (!item) break;
        mod.captureException(item.error, { extra: item.context });
      }
      return mod;
    } catch {
      // Falha em carregar — bloqueia novas tentativas para não thrashear
      return null;
    }
  })();

  return loadingPromise;
}

/**
 * Agenda o carregamento do Sentry após idle (ou 3s).
 * Idempotente: chamadas múltiplas não duplicam o load.
 */
export function initSentry(): void {
  if (initialized || loadingPromise) return;
  if (!shouldLoadSentry()) return;

  const trigger = () => {
    void loadSentry();
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (
      window as Window & {
        requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void;
      }
    ).requestIdleCallback(trigger, { timeout: 3000 });
  } else {
    setTimeout(trigger, 3000);
  }
}

export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!shouldLoadSentry()) return;
  if (sentryRef && initialized) {
    sentryRef.captureException(error, { extra: context });
    return;
  }
  // Buffer com cap para não vazar memória
  if (ERROR_BUFFER.length < BUFFER_MAX) {
    ERROR_BUFFER.push({ error, context });
  }
  // Garante que o load foi agendado (caso initSentry não tenha rodado ainda)
  void loadSentry();
}

export function setSentryUser(user: { id: string; email?: string } | null): void {
  if (!shouldLoadSentry()) return;
  if (sentryRef && initialized) {
    sentryRef.setUser(user);
  } else {
    bufferedUser = user;
    void loadSentry();
  }
}

/**
 * Re-export do ErrorBoundary do Sentry (apenas após o load assíncrono).
 * Não use diretamente — em produção, prefira `EnhancedErrorBoundary` em src/main.tsx
 * que funciona desde o paint inicial.
 */
export function getSentryErrorBoundary(): typeof SentryNS.ErrorBoundary | null {
  return sentryRef?.ErrorBoundary ?? null;
}
