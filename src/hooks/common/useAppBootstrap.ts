import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useGlobalErrorCatcher } from '@/hooks/ui/useErrorHandler';
import { markBootSuccessful } from '@/lib/chunk-recovery';

import { logger } from '@/lib/logger';
/**
 * useAppBootstrap centralizes global initialization used by App.tsx.
 */
export function useAppBootstrap() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const initializedRef = useRef(false);
  const catalogPrefetchedRef = useRef(false);

  useGlobalErrorCatcher();

  // 1. Telemetry and infra are idempotent.
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    markBootSuccessful();
  }, []);

  // 2. Connectivity listeners.
  useEffect(() => {
    const handleStatusChange = () => {
      // Reserved for global offline/online notifications.
    };

    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  // 3. Catalog prefetch runs only after auth and outside the public boot graph.
  useEffect(() => {
    if (authLoading || !isAuthenticated || catalogPrefetchedRef.current) return;

    const timer = window.setTimeout(() => {
      catalogPrefetchedRef.current = true;
      import('@/hooks/products/useCatalogPrefetch')
        .then(({ prefetchCatalog }) => prefetchCatalog(queryClient))
        .catch((error) => {
          logger.warn('[app-bootstrap] catalog prefetch skipped:', error);
        });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [authLoading, isAuthenticated, queryClient]);

  const isHome = location.pathname === '/';

  return {
    isHome,
    authLoading,
    isAuthenticated,
  };
}
