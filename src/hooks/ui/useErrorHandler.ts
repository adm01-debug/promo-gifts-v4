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
  const handleError = useCallback(
    (error: unknown, options?: ErrorHandlerOptions) => {
      const scope = options?.message ? 'useErrorHandler.custom' : 'useErrorHandler.generic';
      const log = createClientLogger(scope);
      
      const msg =
        options?.message ||
        (error instanceof Error ? error.message : 'Ocorreu um erro inesperado');

      // Log estruturado com suporte a Sentry e Correlação
      log.error('error_captured', { 
        err: error, 
        custom_message: options?.message,
        silent: options?.silent 
      });

      if (!options?.silent) {
        toast.error(msg);
      }

      options?.onError?.(error);
    },
    []
  );

  /**
   * Wraps an async function so any thrown error is automatically handled.
   */
  const wrapAsync = useCallback(
    <T extends (...args: never[]) => Promise<unknown>>(
      fn: T,
      options?: ErrorHandlerOptions
    ): ((...args: Parameters<T>) => Promise<ReturnType<T> | undefined>) => {
      return async (...args: Parameters<T>) => {
        try {
          return await fn(...args);
        } catch (error) {
          handleError(error, options);
          return undefined;
        }
      };
    },
    [handleError]
  );

  return { handleError, wrapAsync };
}

/**
 * useGlobalErrorCatcher — Captures unhandled errors & promise rejections globally.
 * Mount once at the app root (e.g. inside App or a top-level provider).
 */
export function useGlobalErrorCatcher() {
  useEffect(() => {
    const log = createClientLogger('GlobalCatcher');

    const onUnhandled = (event: ErrorEvent) => {
      log.error('unhandled_error', { err: event.error });
      toast.error('Erro inesperado. Tente recarregar a página.');
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      log.error('unhandled_rejection', { err: event.reason });
      toast.error('Erro inesperado. Tente recarregar a página.');
    };

    window.addEventListener('error', onUnhandled);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onUnhandled);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);
}
