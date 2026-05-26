import { type ReactNode, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import NProgress from 'nprogress';
import { performanceTracker } from '@/utils/performance';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';

import { getFallback } from '@/components/layout/SkeletonLoaders';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { adminRoutes } from './admin-routes';
import { homeAndClientRoutes, notFoundRoute } from './client-routes';
import { productRoutes } from './product-routes';
import { publicRoutes } from './public-routes';
import { quoteRoutes } from './quote-routes';
import { toolsRoutes } from './tools-routes';

// NProgress configuration
NProgress.configure({ showSpinner: false, speed: 400, minimum: 0.1 });

const AppProviders = lazyWithRetry(() =>
  import('@/components/providers/AppProviders').then((m) => ({ default: m.AppProviders })),
);
const MainLayout = lazyWithRetry(() =>
  import('@/components/layout/MainLayout').then((m) => ({ default: m.MainLayout })),
);

function ProtectedAppLayout() {
  return (
    <AppProviders>
      <MainLayout />
    </AppProviders>
  );
}

/** Location-aware Suspense that renders route-specific skeletons. */
function RouteSuspense({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  useEffect(() => {
    // Start progress and performance tracking on pathname change (navigation)
    NProgress.start();
    performanceTracker.startRouteTransition(pathname);
    
    // Complete progress after a short delay (once the new route should be rendering)
    const timer = setTimeout(() => {
      NProgress.done();
      performanceTracker.endRouteTransition(pathname);
    }, 200);

    return () => {
      clearTimeout(timer);
      NProgress.done();
    };

  }, [pathname]);

  return <Suspense fallback={getFallback(pathname)}>{children}</Suspense>;
}

/**
 * Top-level route tree.
 *
 * Composition:
 * - `publicRoutes` (login, reset, callback, unauthorized) — no auth required
 * - `<ProtectedRoute />` wrapper, with sub-groups inside:
 *   - `productRoutes` — products, filters, novelties, favorites, etc
 *   - `quoteRoutes` — orçamentos
 *   - `adminRoutes` — `/admin/*` (and dev-only nested under `<DevRoute />`)
 *   - `toolsRoutes` — simulador, mockup, BI, magic-up, etc
 *   - `homeAndClientRoutes` — home, dashboard, clientes, redirects
 * - `notFoundRoute` (`*` catch-all) — PÚBLICO, fora do ProtectedRoute,
 *   para que rotas inexistentes mostrem o 404 mesmo sem sessão.
 *   DEVE ser o ÚLTIMO Route (precedência por ordem em react-router-dom).
 */
export function AppRoutes() {
  const { pathname } = useLocation();
  
  return (
    <Routes>
      {/* Public routes usually don't need the complex layout skeletons */}
      <Route element={<Suspense fallback={getFallback(pathname)}>{null}</Suspense>}>
        {publicRoutes}
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<ProtectedAppLayout />}>
          {/* Sub-routes handle their own Suspense inside the layout */}
          <Route path="*" element={
            <Suspense fallback={getFallback(pathname)}>
              <Routes>
                {productRoutes}
                {quoteRoutes}
                {adminRoutes}
                {toolsRoutes}
                {homeAndClientRoutes}
              </Routes>
            </Suspense>
          } />
        </Route>
      </Route>

      {notFoundRoute}
    </Routes>
  );
}
