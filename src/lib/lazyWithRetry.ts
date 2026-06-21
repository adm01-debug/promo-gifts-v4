import { lazy, type ComponentType, createElement } from 'react';
import { logger } from '@/lib/logger';
import { attemptChunkRecovery, isChunkLoadError } from '@/lib/chunk-recovery';
import { getFallback } from '@/components/layout/SkeletonLoaders';

/**
 * Wrapper around React.lazy that retries on chunk loading failures.
 * Handles stale cache issues after deployments and Vite 502 spikes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ForwardRef/Memo components nao satisfazem ComponentType<unknown>; any e necessario p/ inferir T nos call-sites
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  retries = 3,
  interval = 1000,
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: Error | undefined;

    for (let i = 0; i < retries; i++) {
      try {
        const component = await componentImport();
        if (!component || !component.default) {
          throw new Error('Component import returned null or missing default export');
        }
        return component;
      } catch (error) {
        lastError = error as Error;

        if (isChunkLoadError(error)) {
          logger.warn(`Chunk load failed (attempt ${i + 1}/${retries}), retrying...`);
          await new Promise((resolve) => {
            setTimeout(resolve, interval * (i + 1));
          });

          // Última tentativa: aciona recovery agressivo (hard reload + cache bust).
          if (i === retries - 1) {
            const reloaded = await attemptChunkRecovery(error);
            if (reloaded) {
              // Retorna um componente placeholder que renderiza o esqueleto apropriado
              // enquanto o hard-reload acontece no fundo.
              return {
                default: (() => {
                  const url = typeof window !== 'undefined' ? window.location.pathname : '/';
                  return createElement(
                    'div',
                    {
                      className: 'animate-pulse',
                    },
                    getFallback(url),
                  );
                }) as unknown as T,
              };
            }
            throw error;
          }
        } else {
          throw error;
        }
      }
    }

    throw lastError;
  });
}
