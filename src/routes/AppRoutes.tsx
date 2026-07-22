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
import { OptimizedImageDemo } from './lazy-pages';

// NProgress configuration
NProgress.configure({ showSpinner: false, speed: 250, minimum: 0.2, trickleSpeed: 100 });

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

function RouteSuspense({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  useEffect(() => {
    // Start progress and performance tracking on pathname change (navigation)
    NProgress.start();
    performanceTracker.startRouteTransition(pathname);

    // No longer using a fixed delay: we wait for the Suspense to resolve.
    // NProgress.done() should be called when the component is mounted.
    // However, since this is a global wrapper, we'll use a safer approach.
    return () => {
      NProgress.done();
      performanceTracker.endRouteTransition(pathname);
    };
  }, [pathname]);

  return (
    <Suspense
      fallback={<div onAnimationStart={() => NProgress.start()}>{getFallback(pathname)}</div>}
    >
      <RouteSuspenseDone>{children}</RouteSuspenseDone>
    </Suspense>
  );
}

/** Helper to signal completion when Suspense resolves */
function RouteSuspenseDone({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  useEffect(() => {
    NProgress.done();
    performanceTracker.endRouteTransition(pathname);
  }, [pathname]);

  return <>{children}</>;
}

/**
 * Top-level route tree.
 *
 * Composition:
 * - `publicRoutes` (login, reset, callback, unauthorized) — no auth required
 * - `debugRoutes` — dev/QA tools, no auth, publicly accessible in all envs
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
  return (
    <RouteSuspense>
      <Routes>
        {publicRoutes}

        {/* Debug / QA routes — no auth required in any environment.
            These pages do not expose sensitive user data and must be
            accessible to E2E tests (Playwright routes-public project)
            and to local development tooling without a logged-in session.
            /debug/images was previously inside toolsRoutes (ProtectedRoute)
            which caused E2E specs to fail with auth redirect. */}
        <Route path="/debug/images" element={<OptimizedImageDemo />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<ProtectedAppLayout />}>
            {productRoutes}
            {quoteRoutes}
            {adminRoutes}
            {toolsRoutes}
            {homeAndClientRoutes}
          </Route>
        </Route>

        {notFoundRoute}
      </Routes>
    </RouteSuspense>
  );
}
