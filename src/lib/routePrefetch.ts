/**
 * Route prefetching — preloads lazy-loaded page chunks on hover/touch.
 *
 * Maps route paths to their dynamic import functions so that hovering a
 * navigation link triggers the chunk download before the user clicks.
 */

const routeImportMap: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/pages/Index'),
  '/dashboard': () => import('@/pages/CustomizableDashboard'),
  '/filtros': () => import('@/pages/products/FiltersPage'),
  '/produtos': () => import('@/pages/products/FiltersPage'),
  '/novidades': () => import('@/pages/products/NoveltiesPage'),
  '/favoritos': () => import('@/pages/products/FavoritesPage'),
  '/comparar': () => import('@/pages/products/ComparePage'),
  '/carrinhos': () => import('@/pages/products/SellerCartsPage'),
  '/colecoes': () => import('@/pages/collections/CollectionsPage'),
  '/orcamentos': () => import('@/pages/quotes/QuotesListPage'),
  '/orcamentos/novo': () => import('@/pages/quotes/QuoteBuilderPage'),
  '/orcamentos/kanban': () => import('@/pages/quotes/QuotesKanbanPage'),
  '/orcamentos/dashboard': () => import('@/pages/quotes/QuotesDashboardPage'),
  
  '/simulador': () => import('@/pages/tools/SimuladorWizard'),
  '/simulador-precos': () => import('@/pages/tools/PriceSimulatorPage'),
  '/estoque': () => import('@/pages/admin/StockDashboardPage'),
  '/mockup-generator': () => import('@/pages/mockups/MockupGenerator'),
  '/magic-up': () => import('@/pages/tools/MagicUp'),
  '/montar-kit': () => import('@/pages/kit-builder/KitBuilderPage'),
  '/meus-kits': () => import('@/pages/kit-builder/KitLibraryPage'),
  '/clientes': () => import('@/pages/clients/ClientsPage'),
  '/tendencias': () => import('@/pages/bi/TrendsPage'),
  '/busca-preco': () => import('@/pages/tools/AdvancedPriceSearchPage'),
  '/inteligencia-comercial': () => import('@/pages/bi/CommercialIntelligencePage'),
  '/admin/usuarios': () => import('@/pages/admin/AdminUsuariosPage'),
  '/admin/telemetria': () => import('@/pages/admin/AdminTelemetriaPage'),
  '/admin/cadastros': () => import('@/pages/admin/AdminCadastrosPage'),
  '/admin/conexoes': () => import('@/pages/admin/AdminConexoesStatusPage'),
};

const prefetched = new Set<string>();

/**
 * Prefetch the JS chunk for a given route path.
 * Safe to call multiple times — each route is only fetched once.
 */
export function prefetchRoute(path: string): void {
  if (prefetched.has(path)) return;

  const importer = routeImportMap[path];
  if (!importer) return;

  prefetched.add(path);
  // Use requestIdleCallback when available for non-blocking prefetch
  const schedule =
    typeof requestIdleCallback === 'function'
      ? requestIdleCallback
      : (fn: () => void) => setTimeout(fn, 0);

  schedule(() => {
    importer().catch(() => {
      // Remove from set so it can be retried
      prefetched.delete(path);
    });
  });
}

/**
 * Props to spread on a link element (or wrapper) to enable prefetch on hover/touch.
 */
export function getPrefetchHandlers(path: string) {
  return {
    onMouseEnter: () => prefetchRoute(path),
    onTouchStart: () => prefetchRoute(path),
  };
}
