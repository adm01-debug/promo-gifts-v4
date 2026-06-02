import {
  QueryClient,
  type DefaultOptions,
  type QueryClientConfig,
} from '@tanstack/react-query';

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

  // TECNICAS — semi-static personalization data
  'tecnicas-unificadas': CACHE_TIMES.TECNICAS,
  techniques: CACHE_TIMES.TECNICAS,

  // TABELAS_PRECO — mid-volatility pricing
  'tabelas-preco': CACHE_TIMES.TABELAS_PRECO,

  // PRODUTOS — catalog (also the default for unknown keys)
  produtos: CACHE_TIMES.PRODUTOS,
  products: CACHE_TIMES.PRODUTOS,
  'catalog-products': CACHE_TIMES.PRODUTOS,
  'sparkline-supplier-batch': CACHE_TIMES.PRODUTOS,

  // DYNAMIC — frequently-changing operational data
  quotes: CACHE_TIMES.DYNAMIC,
  notifications: CACHE_TIMES.DYNAMIC,
  'workspace-notifications': CACHE_TIMES.DYNAMIC,
  'quote-history': CACHE_TIMES.DYNAMIC,

  // REALTIME — near real-time signals
  'connection-status': CACHE_TIMES.REALTIME,
  'bridge-health': CACHE_TIMES.REALTIME,
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
      if (query.options.staleTime === undefined) {
        query.options.staleTime = getStaleTimeForKey(query.queryKey);
      }
      if (query.options.gcTime === undefined) {
        query.options.gcTime = getGcTimeForKey(query.queryKey);
      }
    }
  });

  // Expose to window for edge-case prefetching (e.g. hover on cards) — dev only.
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).queryClient = client;
  }

  return client;
}
