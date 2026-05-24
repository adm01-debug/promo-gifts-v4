import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * 🚀 PREFETCH CORE CHUNKS: Warm up the next predicted routes for instant feel.
 *
 * Triggers eager `import()` on contextually likely-next pages based on
 * current pathname. Has no DOM output — returns null.
 *
 * IMPORTANTE: Só pré-carrega chunks de rotas PROTEGIDAS quando o usuário
 * está autenticado. Visitantes anônimos não devem baixar bundles que
 * só serão usados após login (economia de banda + UX).
 */
export function RoutePrefetcher() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    type ConnectionInfo = {
      saveData?: boolean;
      effectiveType?: string;
    };

    type NavigatorWithConnection = Navigator & {
      connection?: ConnectionInfo;
    };

    // Only prefetch if we're not on a mobile connection or low power mode
    const connection =
      typeof window !== 'undefined' && typeof navigator !== 'undefined'
        ? (navigator as NavigatorWithConnection).connection
        : undefined;

    if (connection && (connection.saveData || connection.effectiveType === '2g')) {
      return;
    }

    // Anonymous visitors: only prefetch Auth chunk (entry point).
    // Don't waste bandwidth on protected dashboard chunks they can't reach.
    if (!user) {
      if (pathname !== '/auth' && pathname !== '/login') {
        import('@/pages/auth/Auth');
      }
      return;
    }

    // Authenticated users: prefetch likely-next protected routes.
    if (pathname === '/auth' || pathname === '/login') {
      // Prefetch dashboard early
      import('@/pages/Index');
      import('@/pages/products/FiltersPage');
    } else if (pathname === '/') {
      // Prefetch heavy pages from dashboard + Auth (sessão pode expirar)
      import('@/pages/products/FiltersPage');
      import('@/pages/quotes/QuotesListPage');
      import('@/pages/clients/ClientsPage');
      import('@/pages/auth/Auth');
    } else if (pathname === '/produtos') {
      import('@/pages/products/ProductDetail');
      import('@/pages/tools/PriceSimulatorPage');
    }

    // Secondary priority prefetch
    const timeoutId = setTimeout(() => {
      if (pathname !== '/orcamentos/novo') import('@/pages/quotes/QuoteBuilderPage');
      if (pathname === '/produtos') import('@/pages/mockups/MockupGenerator');
    }, 2500);

    return () => clearTimeout(timeoutId);
  }, [pathname, user]);

  return null;
}
