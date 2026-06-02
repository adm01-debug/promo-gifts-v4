import {
  QueryClient,
  type DefaultOptions,
  type QueryClientConfig,
} from '@tanstack/react-query';

// ─────────────────────────────────────────────────────────────────────────────
// Stale-time constants (milliseconds)
// ─────────────────────────────────────────────────────────────────────────────

/** Static reference data that almost never changes (roles, categories, etc.) */
const STALE_STATIC = 30 * 60 * 1000; // 30 min

/** Semi-static data refreshed on user action (product catalog, suppliers) */
const STALE_SEMI = 10 * 60 * 1000; // 10 min

/** Frequently-changing operational data (quotes, notifications) */
const STALE_LIVE = 2 * 60 * 1000; // 2 min

/** Data that should always be fresh (real-time indicators) */
const STALE_REALTIME = 30 * 1000; // 30 s

/** Default fallback — data that hasn't been explicitly categorised */
const STALE_DEFAULT = STALE_SEMI;

// ─────────────────────────────────────────────────────────────────────────────
// GC-time constants
// ─────────────────────────────────────────────────────────────────────────────
const GC_DEFAULT = 15 * 60 * 1000; // 15 min (keeps rendered UI snappy on back-nav)
const GC_LONG = 30 * 60 * 1000; // 30 min for slowly-changing taxonomies

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC named cache/GC time buckets — used by hooks that prefer explicit
// per-query overrides instead of the automatic prefix→tier routing below.
//
// CACHE_TIMES = staleTime tiers. Picked by feature, not by query-key prefix.
// GC_TIMES    = gcTime tiers. Mostly mirror staleTime, but allow keeping data
//               around longer than it is "fresh" so back-navigation stays snappy.
//
// These exports are kept stable even when the internal STALE_* constants
// are tuned — consumers reference them by name. Added 2026-06-02 because
// useExternalCategoriesQuery (and likely future hooks) need named tiers.
// ─────────────────────────────────────────────────────────────────────────────
export const CACHE_TIMES = {
  /** Stable reference data — categories, suppliers, materials, techniques */
  STABLE: STALE_STATIC,
  /** Semi-static — product catalog, taxonomy lookups */
  SEMI: STALE_SEMI,
  /** Live — quotes, notifications */
  LIVE: STALE_LIVE,
  /** Real-time — connection status, health checks */
  REALTIME: STALE_REALTIME,
} as const;

export const GC_TIMES = {
  /** Default GC window — most queries */
  DEFAULT: GC_DEFAULT,
  /** Long retention for reference data that's expensive to refetch */
  LONG: GC_LONG,
  /** Categorias técnicas — keep cached across navigations */
  TECNICAS: GC_LONG,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Query-key prefix → stale-time routing
// ─────────────────────────────────────────────────────────────────────────────
type StaleTimeTier = 'static' | 'semi' | 'live' | 'realtime' | 'default';

const prefixToTier: Record<string, StaleTimeTier> = {
  // Static reference data
  categories: 'static',
  suppliers: 'static',
  materials: 'static',
  techniques: 'static',
  roles: 'static',
  'price-tables': 'static',

  // Operational data that changes on user action
  products: 'semi',
  'catalog-products': 'semi',
  'sparkline-supplier-batch': 'semi',

  // Frequently refreshed
  quotes: 'live',
  notifications: 'live',
  'workspace-notifications': 'live',
  'quote-history': 'live',

  // Near real-time
  'connection-status': 'realtime',
  'bridge-health': 'realtime',
};

function resolveStaleTime(queryKey: readonly unknown[]): number {
  if (!Array.isArray(queryKey) || queryKey.length === 0) return STALE_DEFAULT;
  const prefix = String(queryKey[0]);
  const tier = prefixToTier[prefix] ?? 'default';
  switch (tier) {
    case 'static': return STALE_STATIC;
    case 'semi': return STALE_SEMI;
    case 'live': return STALE_LIVE;
    case 'realtime': return STALE_REALTIME;
    default: return STALE_DEFAULT;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Default query options
// ─────────────────────────────────────────────────────────────────────────────
export const defaultQueryOptions: DefaultOptions = {
  queries: {
    // staleTime is resolved per-key at runtime (see createQueryClient)
    gcTime: GC_DEFAULT,
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

  // Override staleTime per query-key prefix using a queryCache observer.
  // This runs once per query creation — cheap, deterministic.
  client.getQueryCache().subscribe((event) => {
    if (event.type === 'added' || event.type === 'updated') {
      const query = event.query;
      if (query.options.staleTime === undefined) {
        query.options.staleTime = resolveStaleTime(query.queryKey);
      }
    }
  });

  // Expose to window for edge-case prefetching (e.g. hover on cards) — dev only.
  // Window's specific shape doesn't overlap with an index signature, so widen via unknown.
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).queryClient = client;
  }

  return client;
}
