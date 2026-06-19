import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { createClientLogger } from '@/lib/telemetry/structuredLogger';

interface ErrorHandlerOptions {
  /** Custom message shown in toast. Falls back to error.message */
  message?: string;
  /** If true, suppress the toast notification */
  silent?: boolean;
  /** Optional callback after handling */
  onError?: (error: unknown) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2026-06-02: detecção de stale chunk error após deploy
//
// Quando o Vercel publica novos hashes de chunks JS, tabs abertas com versão
// antiga tentam fetch dos chunks antigos (que não existem mais).
// O servidor responde com index.html (200, text/html), e o browser recusa:
//   "Failed to fetch dynamically imported module"
//   "Expected a JavaScript-or-Wasm module script but the server responded
//    with a MIME type of text/html"
//
// Solução: detectar esses erros e fazer 1 (e apenas 1) reload automático,
// usando sessionStorage para prevenir loop infinito caso o deploy esteja
// realmente quebrado.
// ─────────────────────────────────────────────────────────────────────────────

const CHUNK_RELOAD_KEY = '__pg_chunk_reload_attempt__';
const CHUNK_RELOAD_MAX = 1;
const CHUNK_RELOAD_DELAY_MS = 1500;
const CHUNK_RELOAD_CLEAR_MS = 5000;

const CHUNK_ERROR_PATTERNS: readonly RegExp[] = [
  /Failed to fetch dynamically imported module/i,
  /Failed to load module script/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Loading chunk \w+ failed/i,
  /ChunkLoadError/i,
  /Expected a JavaScript-or-Wasm module script/i,
];

/**
 * Detecta se um erro é causado por chunk JS faltando (stale deploy).
 * Cobre os padrões observados em Chromium, Firefox e Safari.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const msg =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error);
  if (msg && CHUNK_ERROR_PATTERNS.some((p) => p.test(msg))) return true;
  // Fallback: TypeError cujo stack referencia /assets/*.js é quase sempre chunk error
  if (
    error instanceof TypeError &&
    typeof error.stack === 'string' &&
    /\/assets\/[^/]+\.js/.test(error.stack)
  ) {
    return true;
  }
  return false;
}

function getReloadAttempts(): number {
  try {
    return parseInt(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

function setReloadAttempts(n: number): void {
  try {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(n));
  } catch {
    // sessionStorage indisponível (Safari private etc) — silencia
  }
}

function clearReloadAttempts(): void {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    // ignora
  }
}

/**
 * Trata um chunk error detectado: tenta 1 reload automático, ou orienta o
 * usuário a fazer hard refresh se já tentamos antes nesta sessão.
 */
function handleChunkLoadError(error: unknown, log: ReturnType<typeof createClientLogger>): boolean {
  const attempts = getReloadAttempts();

  if (attempts >= CHUNK_RELOAD_MAX) {
    log.error('chunk_load_error_max_reload_reached', { err: error, attempts });
    toast.error(
      'Não foi possível carregar a nova versão. Pressione Ctrl+Shift+R (Cmd+Shift+R no Mac) para atualizar.',
      { duration: 12000 },
    );
    return false;
  }

  setReloadAttempts(attempts + 1);
  log.warn('chunk_load_error_reloading', { err: error, attempts });
  toast.info('Nova versão disponível. Atualizando…', { duration: CHUNK_RELOAD_DELAY_MS + 500 });

  window.setTimeout(() => {
    window.location.reload();
  }, CHUNK_RELOAD_DELAY_MS);

  return true;
}

/**
 * Wrapper opcional para React.lazy que tenta novamente uma vez ao falhar.
 * Uso (futuro, em rotas que sofrem com isso):
 *   const Page = lazy(lazyWithRetry(() => import('./Page')));
 */
export function lazyWithRetry<T>(importFn: () => Promise<T>, retries = 1): () => Promise<T> {
  return async () => {
    try {
      return await importFn();
    } catch (error) {
      if (!isChunkLoadError(error) || retries <= 0) throw error;
      await new Promise((resolve) => {
        setTimeout(resolve, 800);
      });
      return importFn();
    }
  };
}

/**
 * useErrorHandler — Centralised async error handling with toast notifications.
 *
 * Usage:
 *   const { handleError, wrapAsync } = useErrorHandler();
 *
 *   // Option A: wrap an async fn
 *   const safeSave = wrapAsync(async () => { ... });
 *
 *   // Option B: catch manually
 *   try { ... } catch (e) { handleError(e, { message: 'Falha ao salvar' }); }
 */
export function useErrorHandler() {
  const handleError = useCallback((error: unknown, options?: ErrorHandlerOptions) => {
    const scope = options?.message ? 'useErrorHandler.custom' : 'useErrorHandler.generic';
    const log = createClientLogger(scope);

    const msg =
      options?.message || (error instanceof Error ? error.message : 'Ocorreu um erro inesperado');

    // Log estruturado com suporte a Sentry e Correlação
    log.error('error_captured', {
      err: error,
      custom_message: options?.message,
      silent: options?.silent,
    });

    if (!options?.silent) {
      toast.error(msg);
    }

    options?.onError?.(error);
  }, []);

  /**
   * Wraps an async function so any thrown error is automatically handled.
   */
  const wrapAsync = useCallback(
    <T extends (...args: never[]) => Promise<unknown>>(
      fn: T,
      options?: ErrorHandlerOptions,
    ): ((...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | undefined>) => {
      return async (...args: Parameters<T>) => {
        try {
          return (await fn(...args)) as Awaited<ReturnType<T>>;
        } catch (error) {
          handleError(error, options);
          return undefined;
        }
      };
    },
    [handleError],
  );

  return { handleError, wrapAsync };
}

/**
 * useGlobalErrorCatcher — Captures unhandled errors & promise rejections globally.
 * Mount once at the app root (e.g. inside App or a top-level provider).
 *
 * FIX 2026-06-02: agora detecta chunk load errors (stale deploy) e dispara
 * reload automático em vez de mostrar toast genérico de "erro inesperado".
 */
export function useGlobalErrorCatcher() {
  useEffect(() => {
    const log = createClientLogger('GlobalCatcher');

    // Carregou com sucesso — limpa o contador de reload após grace period
    const clearTimer = window.setTimeout(() => {
      clearReloadAttempts();
    }, CHUNK_RELOAD_CLEAR_MS);

    const onUnhandled = (event: ErrorEvent) => {
      // Chunk error detectado (deploy stale) — auto-reload
      if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
        event.preventDefault();
        handleChunkLoadError(event.error ?? event.message, log);
        return;
      }
      log.error('unhandled_error', { err: event.error });
      void import('@/services/telemetryService')
        .then(({ telemetryService }) => {
          telemetryService.logError('unhandled_error', event.error);
        })
        .catch(() => undefined);
      toast.error('Erro inesperado. Tente recarregar a página.');
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Chunk error em Promise rejection (caso mais comum: import() falhou)
      if (isChunkLoadError(event.reason)) {
        event.preventDefault();
        handleChunkLoadError(event.reason, log);
        return;
      }
      log.error('unhandled_rejection', { err: event.reason });
      void import('@/services/telemetryService')
        .then(({ telemetryService }) => {
          telemetryService.logError('unhandled_rejection', event.reason);
        })
        .catch(() => undefined);
      toast.error('Erro inesperado. Tente recarregar a página.');
    };

    window.addEventListener('error', onUnhandled);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.clearTimeout(clearTimer);
      window.removeEventListener('error', onUnhandled);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);
}
