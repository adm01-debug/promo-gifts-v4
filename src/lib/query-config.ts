import { QueryClient, type DefaultOptions, type QueryClientConfig } from '@tanstack/react-query';

// ─────────────────────────────────────────────────────────────────────────────
// CACHE_TIMES — staleTime tiers (milliseconds)
//
// Increasing durations from NONE (no cache) to VERY_STABLE (24h). Exact values
// are pinned by tests/lib/query-config{,-extended}.test.ts — do not change
// without updating those tests.
//
// Order invariant (asserted by the test suite):
//   NONE < REALTIME < DYNAMIC < PRODUTOS < TABELAS_PRECO < TECNICAS
//                  < STABLE < VERY_STABLE
// ─────────────────────────────────────────────────────────────────────────────
export const CACHE_TIMES = {
  /** No caching — always considered stale */
  NONE: 0,
  /** 1 min — connection status, presence indicators, near real-time */
  REALTIME: 60 * 1000,
  /** 5 min — frequently-changing operational data (quotes, notifications) */
  DYNAMIC: 5 * 60 * 1000,
  /** 10 min — product catalog, supplier batches (default fallback) */
  PRODUTOS: 10 * 60 * 1000,
  /** 15 min — price tables, mid-volatility lookups */
  TABELAS_PRECO: 15 * 60 * 1000,
  /** 30 min — techniques, supplier metadata, semi-static config */
  TECNICAS: 30 * 60 * 1000,
  /** 1 hour — stable reference data: categories, materials, roles */
  STABLE: 60 * 60 * 1000,
  /** 24 hours — colors, brand palettes, near-immutable taxonomies */
  VERY_STABLE: 24 * 60 * 60 * 1000,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// GC_TIMES — gcTime tiers (milliseconds)
//
// How long inactive cached queries stay in memory after their last subscriber
// unmounts. Generally longer than the matching staleTime so back-navigation
// stays snappy even when data is technically stale.
// ─────────────────────────────────────────────────────────────────────────────
export const GC_TIMES = {
  /** 15 min — most queries */
  DEFAULT: 15 * 60 * 1000,
  /** 30 min — techniques, categories, slow-changing taxonomies */
  TECNICAS: 30 * 60 * 1000,
  /** 1 hour — very stable reference data */
  LONG: 60 * 60 * 1000,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// QUERY_KEY_PREFIXES — canonical first-element strings for queryKey tuples
// ─────────────────────────────────────────────────────────────────────────────
export const QUERY_KEY_PREFIXES = {
  PRODUTO_PERSONALIZACAO: 'products',
  PRODUTOS: 'produtos',
  CATALOG_PRODUCTS: 'catalog-products',
  TECNICAS: 'tecnicas-unificadas',
  TABELAS_PRECO: 'tabelas-preco',
  CATEGORIES: 'categories',
  SUPPLIERS: 'suppliers',
  MATERIALS: 'materials',
  COLORS: 'colors',
  ROLES: 'roles',
  QUOTES: 'quotes',
  NOTIFICATIONS: 'notifications',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Prefix → staleTime / gcTime maps used by the resolver functions below
// ─────────────────────────────────────────────────────────────────────────────
const PREFIX_STALE_MAP: Record<string, number> = {
  // VERY_STABLE — practically immutable
  colors: CACHE_TIMES.VERY_STABLE,

  // STABLE — reference taxonomies
  categories: CACHE_TIMES.STABLE,
  suppliers: CACHE_TIMES.STABLE,
  materials: CACHE_TIMES.STABLE,
  roles: CACHE_TIMES.STABLE,
  'price-tables': CACHE_TIMES.STABLE,
  'faixas-preco-oficial': CACHE_TIMES.STABLE,
  'category-icons': CACHE_TIMES.STABLE,
  'global-leaf-categories': CACHE_TIMES.STABLE,
  'color-system-external': CACHE_TIMES.STABLE,
  'commemorative-dates': CACHE_TIMES.STABLE,
  'external-techniques-catalog': CACHE_TIMES.STABLE,
  'component-locations': CACHE_TIMES.STABLE,
  'group-components': CACHE_TIMES.STABLE,
  'group-locations': CACHE_TIMES.STABLE,
  'location-techniques': CACHE_TIMES.STABLE,
  'group-location-techniques': CACHE_TIMES.STABLE,

  // TECNICAS — semi-static personalization data
  'tecnicas-unificadas': CACHE_TIMES.TECNICAS,
  techniques: CACHE_TIMES.TECNICAS,
  'all-technique-dimensions-v7': CACHE_TIMES.TECNICAS,
  'external-print-areas': CACHE_TIMES.TECNICAS,
  'kit-print-areas': CACHE_TIMES.TECNICAS,
  'has-print-areas': CACHE_TIMES.TECNICAS,
  'available-sizes': CACHE_TIMES.TECNICAS,

  // TABELAS_PRECO — mid-volatility pricing
  'tabelas-preco': CACHE_TIMES.TABELAS_PRECO,

  // PRODUTOS — catalog (also the default for unknown keys)
  produtos: CACHE_TIMES.PRODUTOS,
  products: CACHE_TIMES.PRODUTOS,
  'catalog-products': CACHE_TIMES.PRODUTOS,
  'sparkline-supplier-batch': CACHE_TIMES.PRODUTOS,
  'external-product': CACHE_TIMES.PRODUTOS,
  'external-products-list': CACHE_TIMES.PRODUTOS,
  'external-products-search': CACHE_TIMES.PRODUTOS,
  'catalog-preferences': CACHE_TIMES.PRODUTOS,
  'catalog-real-stats': CACHE_TIMES.PRODUTOS,
  'expiring-novelties': CACHE_TIMES.PRODUTOS,
  'is-novelty': CACHE_TIMES.PRODUTOS,
  'discontinued-check': CACHE_TIMES.PRODUTOS,
  'kit-components': CACHE_TIMES.PRODUTOS,
  'kit-templates': CACHE_TIMES.PRODUTOS,
  'kit-variant-options': CACHE_TIMES.PRODUTOS,
  'kit-suggestions': CACHE_TIMES.PRODUTOS,

  // DYNAMIC — frequently-changing operational data (5min)
  quotes: CACHE_TIMES.DYNAMIC,
  notifications: CACHE_TIMES.DYNAMIC,
  'workspace-notifications': CACHE_TIMES.DYNAMIC,
  'quote-history': CACHE_TIMES.DYNAMIC,
  'external-variant-stock': CACHE_TIMES.DYNAMIC,
  'kit-stock-validation': CACHE_TIMES.DYNAMIC,
  'client-orders-history': CACHE_TIMES.DYNAMIC,
  'client-top-products': CACHE_TIMES.DYNAMIC,
  'crm-companies': CACHE_TIMES.DYNAMIC,
  'crm-companies-infinite': CACHE_TIMES.DYNAMIC,
  'crm-companies-selector': CACHE_TIMES.DYNAMIC,
  'crm-company': CACHE_TIMES.DYNAMIC,
  'crm-customer': CACHE_TIMES.DYNAMIC,
  'cart-companies-local': CACHE_TIMES.DYNAMIC,
  'cart-companies-search': CACHE_TIMES.DYNAMIC,
  'ai-usage-logs': CACHE_TIMES.DYNAMIC,
  'ai-usage-stats': CACHE_TIMES.DYNAMIC,
  'ai-usage-quotas': CACHE_TIMES.DYNAMIC,
  'ai-quota-status': CACHE_TIMES.DYNAMIC,
  'discount-notifications': CACHE_TIMES.DYNAMIC,
  'discount-approval-queue': CACHE_TIMES.DYNAMIC,
  'discount-approval-detail': CACHE_TIMES.DYNAMIC,
  'discount-approval-audit': CACHE_TIMES.DYNAMIC,
  'app-health-summary': CACHE_TIMES.DYNAMIC,
  'audit-history': CACHE_TIMES.DYNAMIC,
  'admin-discount-exceeded': CACHE_TIMES.DYNAMIC,
  'admin-discount-impact': CACHE_TIMES.DYNAMIC,
  'admin-seller-discount-limits': CACHE_TIMES.DYNAMIC,
  'admin-kit-templates': CACHE_TIMES.DYNAMIC,
  'admin-kit-templates-metrics': CACHE_TIMES.DYNAMIC,
  'admin-kit-items-heatmap': CACHE_TIMES.DYNAMIC,
  'admin-cf-images': CACHE_TIMES.DYNAMIC,
  'admin-all-memberships': CACHE_TIMES.DYNAMIC,
  'admin-products-promobrind-full': CACHE_TIMES.DYNAMIC,
  'admin-product-groups-search': CACHE_TIMES.DYNAMIC,
  'kit-health-history': CACHE_TIMES.DYNAMIC,
  'kit-builder': CACHE_TIMES.DYNAMIC,

  // REALTIME-BACKED — invalidados por canal supabase (30s fallback)
  'custom-kits': CACHE_TIMES.REALTIME,
  'favorite-items': CACHE_TIMES.REALTIME,
  'favorite-lists': CACHE_TIMES.REALTIME,
  'favorite-membership': CACHE_TIMES.REALTIME,
  'favorite-trash': CACHE_TIMES.REALTIME,
  'favorites-weekly-count': CACHE_TIMES.REALTIME,
  'collections-weekly-count': CACHE_TIMES.REALTIME,

  // REALTIME — near real-time signals
  'connection-status': CACHE_TIMES.REALTIME,
  'bridge-health': CACHE_TIMES.REALTIME,
  'integrations-health': CACHE_TIMES.REALTIME,
  'failed-deliveries': CACHE_TIMES.REALTIME,
  'connections-pulse-bar': CACHE_TIMES.REALTIME,
  'connections-recent-incidents': CACHE_TIMES.REALTIME,
  'connections-incident-timeline-72h': CACHE_TIMES.REALTIME,

  // BI / INTELLIGENCE — dashboards analíticos (5min = DYNAMIC para dados operacionais)
  // Evita refetch completo a cada navegação para a página de BI.
  'market-intelligence': CACHE_TIMES.DYNAMIC,
  'bi-kpis': CACHE_TIMES.DYNAMIC,
  bi: CACHE_TIMES.DYNAMIC,
  'bi-bundle-suggestions': CACHE_TIMES.DYNAMIC,
  'bi-client-affinity-v2': CACHE_TIMES.DYNAMIC,
  'bi-client-category-affinity-raw': CACHE_TIMES.DYNAMIC,
  'bi-industry-category-trends': CACHE_TIMES.DYNAMIC,
  'bi-industry-trends-v2': CACHE_TIMES.DYNAMIC,
  'bi-lookalikes': CACHE_TIMES.DYNAMIC,
  'bundle-suggestions': CACHE_TIMES.DYNAMIC,
  'commercial-intelligence': CACHE_TIMES.DYNAMIC,
  'commercial-category-ranking': CACHE_TIMES.DYNAMIC,
  'commercial-opportunities': CACHE_TIMES.DYNAMIC,
  'commercial-segments': CACHE_TIMES.DYNAMIC,
  'commercial-supplier-sales': CACHE_TIMES.DYNAMIC,
  'commercial-top-clients': CACHE_TIMES.DYNAMIC,
  'intelligence-kpis': CACHE_TIMES.DYNAMIC,
  'intelligence-chart': CACHE_TIMES.DYNAMIC,
  'intelligence-product-ids': CACHE_TIMES.DYNAMIC,
  'trending-products': CACHE_TIMES.DYNAMIC,
  'category-ranking': CACHE_TIMES.DYNAMIC,
  'supplier-sales': CACHE_TIMES.DYNAMIC,
  'sales-overview': CACHE_TIMES.DYNAMIC,
  'unmet-demand': CACHE_TIMES.DYNAMIC,
  'hot-searches': CACHE_TIMES.DYNAMIC,
  'conversion-funnel': CACHE_TIMES.DYNAMIC,
  'trends-heatmap': CACHE_TIMES.DYNAMIC,
  'trends-forecast': CACHE_TIMES.DYNAMIC,
  'trends-insights': CACHE_TIMES.DYNAMIC,
  'top-categories': CACHE_TIMES.DYNAMIC,
  'mockup-history': CACHE_TIMES.DYNAMIC,
  'ema-coverage-stats': CACHE_TIMES.DYNAMIC,
  'ema-kpi-by-level': CACHE_TIMES.DYNAMIC,
  'ema-pipeline-health': CACHE_TIMES.DYNAMIC,
  'ema-risk-summary-banner': CACHE_TIMES.DYNAMIC,
  'active-sales-goal': CACHE_TIMES.DYNAMIC,
  'color-enrichment-batch': CACHE_TIMES.DYNAMIC,
  'color-fanout': CACHE_TIMES.DYNAMIC,
  'external-tags-admin': CACHE_TIMES.DYNAMIC,
  'component-media': CACHE_TIMES.DYNAMIC,
  'fav-client-picker-search': CACHE_TIMES.DYNAMIC,
};

const PREFIX_GC_MAP: Record<string, number> = {
  'tecnicas-unificadas': GC_TIMES.TECNICAS,
  techniques: GC_TIMES.TECNICAS,
  'tabelas-preco': GC_TIMES.TECNICAS,
  colors: GC_TIMES.LONG,
  categories: GC_TIMES.LONG,
  suppliers: GC_TIMES.LONG,
  materials: GC_TIMES.LONG,
};

/**
 * Returns the appropriate staleTime for a given queryKey tuple.
 * Falls back to CACHE_TIMES.PRODUTOS when the key is empty, non-array,
 * has a non-string first element, or matches no known prefix.
 *
 * Pinned by tests/lib/query-config{,-extended}.test.ts.
 */
export function getStaleTimeForKey(queryKey: readonly unknown[]): number {
  if (!Array.isArray(queryKey) || queryKey.length === 0) return CACHE_TIMES.PRODUTOS;
  const first = queryKey[0];
  if (typeof first !== 'string') return CACHE_TIMES.PRODUTOS;
  return PREFIX_STALE_MAP[first] ?? CACHE_TIMES.PRODUTOS;
}

/**
 * Returns the appropriate gcTime for a given queryKey tuple.
 * Falls back to GC_TIMES.DEFAULT for unknown prefixes / non-string keys.
 *
 * Pinned by tests/lib/query-config{,-extended}.test.ts.
 */
export function getGcTimeForKey(queryKey: readonly unknown[]): number {
  if (!Array.isArray(queryKey) || queryKey.length === 0) return GC_TIMES.DEFAULT;
  const first = queryKey[0];
  if (typeof first !== 'string') return GC_TIMES.DEFAULT;
  return PREFIX_GC_MAP[first] ?? GC_TIMES.DEFAULT;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-domain query option presets — spread into useQuery calls.
//
// Pinned by tests/lib/query-config{,-extended}.test.ts:
//   PRODUTOS_QUERY_OPTIONS.staleTime         === CACHE_TIMES.PRODUTOS
//   TECNICAS_QUERY_OPTIONS.staleTime         === CACHE_TIMES.TECNICAS
//   TECNICAS_QUERY_OPTIONS.refetchOnMount    === false  (extra: also focus)
//   TABELAS_PRECO_QUERY_OPTIONS.staleTime    === CACHE_TIMES.TABELAS_PRECO
//   STABLE_DATA_QUERY_OPTIONS.staleTime      === CACHE_TIMES.STABLE
//   *_QUERY_OPTIONS.refetchOnWindowFocus     === false
// ─────────────────────────────────────────────────────────────────────────────
export const PRODUTOS_QUERY_OPTIONS = {
  staleTime: CACHE_TIMES.PRODUTOS,
  gcTime: GC_TIMES.DEFAULT,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
} as const;

export const TECNICAS_QUERY_OPTIONS = {
  staleTime: CACHE_TIMES.TECNICAS,
  gcTime: GC_TIMES.TECNICAS,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
} as const;

export const TABELAS_PRECO_QUERY_OPTIONS = {
  staleTime: CACHE_TIMES.TABELAS_PRECO,
  gcTime: GC_TIMES.TECNICAS,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
} as const;

export const STABLE_DATA_QUERY_OPTIONS = {
  staleTime: CACHE_TIMES.STABLE,
  gcTime: GC_TIMES.LONG,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// BI / Intelligence query options — dashboards analíticos
// Cache de 5 min evita refetch completo a cada navegação para páginas de BI.
// ─────────────────────────────────────────────────────────────────────────────
export const BI_QUERY_OPTIONS = {
  staleTime: CACHE_TIMES.DYNAMIC,
  gcTime: GC_TIMES.DEFAULT,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Default query options
// ─────────────────────────────────────────────────────────────────────────────
export const defaultQueryOptions: DefaultOptions = {
  queries: {
    // staleTime / gcTime are resolved per-key at runtime (see createQueryClient)
    gcTime: GC_TIMES.DEFAULT,
    retry: (failureCount, error) => {
      // Never retry on auth errors or 404s
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status: number }).status;
        if (status === 401 || status === 403 || status === 404) return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// QueryClient factory
// ─────────────────────────────────────────────────────────────────────────────
export function createQueryClient(): QueryClient {
  const config: QueryClientConfig = {
    defaultOptions: defaultQueryOptions,
  };

  const client = new QueryClient(config);

  // Override staleTime / gcTime per query-key prefix using a queryCache observer.
  // Runs once per query creation — cheap, deterministic, no per-render cost.
  client.getQueryCache().subscribe((event) => {
    if (event.type === 'added' || event.type === 'updated') {
      const query = event.query;
      const opts = query.options as Record<string, unknown>;
      if (opts.staleTime === undefined) {
        opts.staleTime = getStaleTimeForKey(query.queryKey);
      }
      if (opts.gcTime === undefined) {
        opts.gcTime = getGcTimeForKey(query.queryKey);
      }
    }
  });

  // Expose to window for edge-case prefetching (e.g. hover on cards) — dev only.
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).queryClient = client;
  }

  return client;
}
