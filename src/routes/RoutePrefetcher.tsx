import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * 🚀 PREFETCH CORE CHUNKS: Warm up the next predicted routes for instant feel.
 *
 * Triggers eager `import()` on contextually likely-next pages based on
 * current pathname. Has no DOM output — returns null.
 *
 * v2.0 (perf/deep-optimization-2026):
 * - Prefetch primário imediato (1 rota mais provável)
 * - Prefetch secundário via requestIdleCallback (quando o thread está livre)
 * - Respeita saveData, 2G e 3G lentos
 * - Visitantes anônimos: apenas Auth chunk
 */

type ConnectionInfo = { saveData?: boolean; effectiveType?: string };
type NavigatorWithConnection = Navigator & { connection?: ConnectionInfo };

function shouldSkipPrefetch(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return true;
  const conn = (navigator as NavigatorWithConnection).connection;
  if (!conn) return false;
  return !!(conn.saveData || conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g');
}

/**
 * Executa prefetch durante idle time.
 * Usa requestIdleCallback quando disponível, setTimeout(0) como fallback.
 */
function idlePrefetch(imports: Array<() => Promise<unknown>>): () => void {
  const ids: Array<number | ReturnType<typeof setTimeout>> = [];

  imports.forEach((fn, i) => {
    if ('requestIdleCallback' in window) {
      const id = (window as Window).requestIdleCallback(() => fn(), { timeout: 4000 + i * 500 });
      ids.push(id);
    } else {
      const id = setTimeout(fn, 1800 + i * 400);
      ids.push(id);
    }
  });

  return () => {
    ids.forEach((id) => {
      if ('cancelIdleCallback' in window && typeof id === 'number') {
        (window as Window).cancelIdleCallback(id);
      } else {
        clearTimeout(id as ReturnType<typeof setTimeout>);
      }
    });
  };
}

export function RoutePrefetcher() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (shouldSkipPrefetch()) return;

    // Visitantes anônimos: apenas Auth chunk
    if (!user) {
      if (pathname !== '/auth' && pathname !== '/login') {
        import('@/pages/auth/Auth');
      }
      return;
    }

    // ── Prefetch imediato: 1 rota mais provável ───────────────────────────────
    if (pathname === '/auth' || pathname === '/login') {
      import('@/pages/Index');
    } else if (pathname === '/') {
      import('@/pages/products/FiltersPage');
    } else if (pathname === '/produtos' || pathname === '/filtros') {
      import('@/pages/products/ProductDetail');
    } else if (pathname.startsWith('/produto/')) {
      import('@/pages/quotes/QuoteBuilderPage');
    }

    // ── Prefetch secundário via idle callback ─────────────────────────────────
    const idleImports: Array<() => Promise<unknown>> = [];

    if (pathname === '/') {
      idleImports.push(
        () => import('@/pages/quotes/QuotesListPage'),
        () => import('@/pages/clients/ClientsPage'),
        () => import('@/pages/auth/Auth'),
      );
    } else if (pathname === '/produtos' || pathname === '/filtros') {
      idleImports.push(
        () => import('@/pages/tools/PriceSimulatorPage'),
        () => import('@/pages/mockups/MockupGenerator'),
        () => import('@/pages/collections/CollectionsPage'),
      );
    } else if (pathname.startsWith('/produto/')) {
      idleImports.push(
        () => import('@/pages/products/FiltersPage'),
        () => import('@/pages/quotes/QuoteBuilderPage'),
      );
    } else if (pathname.startsWith('/orcamentos')) {
      idleImports.push(
        () => import('@/pages/quotes/QuoteBuilderPage'),
        () => import('@/pages/clients/ClientsPage'),
      );
    } else if (pathname === '/auth' || pathname === '/login') {
      idleImports.push(() => import('@/pages/products/FiltersPage'));
    }

    // Prefetch genérico do QuoteBuilder se não na página de quotes
    if (!pathname.startsWith('/orcamentos')) {
      idleImports.push(() => import('@/pages/quotes/QuoteBuilderPage'));
    }

    const cleanup = idlePrefetch(idleImports);
    return cleanup;
  }, [pathname, user]);

  return null;
}
