import React, {
  createContext,
  useContext,
  type ReactNode,
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
} from 'react';
import type { Product } from '@/types/product-catalog';
import { mapPromobrindToProduct } from '@/utils/product-mapper';
import { fetchPromobrindProducts } from '@/lib/external-db/products';
import { logger } from '@/lib/logger';

// HMR Module Duplication Guard
// We use a global symbol to detect if multiple instances of this module are loaded
const INSTANCE_KEY = Symbol.for('lovable_products_context_instance');
const globalObj = (typeof window !== 'undefined' ? window : {}) as Record<symbol, unknown>;
const isDuplicateModule = !!globalObj[INSTANCE_KEY];
globalObj[INSTANCE_KEY] = globalObj[INSTANCE_KEY] || Math.random();

interface ProductsContextType {
  /** Cached products (only those that have been requested) */
  products: Product[];
  isLoading: boolean;
  /** Resolves a single id (returns undefined if not cached; does NOT trigger fetch) */
  getProductById: (id: string) => Product | undefined;
  /**
   * Batch lookup — returns cached products matching the given ids (in any order).
   * Missing ids are silently skipped; queueing a fetch for them is the caller's
   * responsibility (or rely on the lazy queueFetch fallback).
   */
  getProductsByIds: (ids: string[]) => Product[];
  /** Manually register products into the cache (e.g. from page-level queries) */
  registerProducts: (products: Product[]) => void;
}

export const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

/**
 * Lazy-loading ProductsProvider.
 * Does NOT fetch all 6000+ products on startup.
 * Instead, it fetches products on-demand when requested via getProductById/getProductsByIds.
 * Products from page-level queries can be registered via registerProducts.
 */
export function ProductsProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<Map<string, Product>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [key, setKey] = useState(0); // Force re-mount key

  // HMR Recovery: If we detect a duplicate module via Global Symbol, force a re-mount
  useEffect(() => {
    if (isDuplicateModule) {
      logger.warn('[ProductsContext] HMR duplication detected. Forcing Provider re-mount.');
      setKey((prev) => prev + 1);
    }
  }, []);

  // Refs for stable callbacks
  const cacheRef = useRef<Map<string, Product>>(cache);
  const fetchingRef = useRef<Set<string>>(new Set());
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const batchIdsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
    };
  }, []);

  // Batched fetch: collects IDs over a microtask and fetches them together
  const scheduleBatchFetch = useCallback(() => {
    if (batchTimerRef.current) return; // already scheduled

    batchTimerRef.current = setTimeout(async () => {
      const idsToFetch = [...batchIdsRef.current];
      batchIdsRef.current.clear();
      batchTimerRef.current = null;

      if (idsToFetch.length === 0) return;

      idsToFetch.forEach((id) => fetchingRef.current.add(id));
      if (mountedRef.current) setIsLoading(true);

      try {
        const raw = await fetchPromobrindProducts({
          filters: { id: idsToFetch },
          limit: idsToFetch.length,
        });
        const mapped = raw.map(mapPromobrindToProduct);

        if (mountedRef.current) {
          setCache((prev) => {
            const next = new Map(prev);
            mapped.forEach((p) => next.set(p.id, p));
            return next;
          });
        }
      } catch (err) {
        logger.warn('[ProductsContext] Failed to fetch products by IDs:', err);
      } finally {
        idsToFetch.forEach((id) => fetchingRef.current.delete(id));
        if (mountedRef.current) setIsLoading(false);
      }
    }, 50); // 50ms batching window
  }, []);

  // Queue IDs for lazy fetching
  const queueFetch = useCallback(
    (ids: string[]) => {
      const missing = ids.filter(
        (id) =>
          !cacheRef.current.has(id) && !fetchingRef.current.has(id) && !batchIdsRef.current.has(id),
      );
      if (missing.length === 0) return;

      missing.forEach((id) => batchIdsRef.current.add(id));
      scheduleBatchFetch();
    },
    [scheduleBatchFetch],
  );

  const getProductById = useCallback(
    (id: string): Product | undefined => {
      const cached = cacheRef.current.get(id);
      if (!cached) {
        queueFetch([id]);
      }
      return cached;
    },
    [queueFetch],
  );

  const getProductsByIds = useCallback(
    (ids: string[]): Product[] => {
      const found: Product[] = [];
      const missing: string[] = [];

      for (const id of ids) {
        const cached = cacheRef.current.get(id);
        if (cached) {
          found.push(cached);
        } else {
          missing.push(id);
        }
      }

      if (missing.length > 0) {
        queueFetch(missing);
      }

      return found;
    },
    [queueFetch],
  );

  // Register products from external sources (e.g. page-level useProducts queries)
  const registerProducts = useCallback((products: Product[]) => {
    if (products.length === 0) return;
    setCache((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const p of products) {
        if (!next.has(p.id)) {
          next.set(p.id, p);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  // Memoize the products array from cache
  const products = useMemo(() => [...cache.values()], [cache]);

  const value = useMemo(
    () => ({ products, isLoading, getProductById, getProductsByIds, registerProducts }),
    [products, isLoading, getProductById, getProductsByIds, registerProducts],
  );

  return (
    <ProductsContext.Provider key={key} value={value}>
      {children}
    </ProductsContext.Provider>
  );
}

/**
 * No-op fallback returned when the context is unexpectedly missing.
 * This prevents the entire app from crashing under HMR race conditions or
 * Suspense edge-cases where a consumer mounts before the provider re-evaluates.
 * Page-level data still loads via useProducts/useExternalProducts queries.
 */
const FALLBACK_CONTEXT: ProductsContextType = {
  products: [],
  isLoading: false,
  getProductById: () => undefined,
  getProductsByIds: () => [],
  registerProducts: () => {},
};

/**
 * Strict consumer — returns a no-op fallback (with dev warning) if used outside ProductsProvider.
 * The fallback prevents app-wide crashes during HMR module-duplication races; in production
 * builds the fallback path is silent.
 */
export function useProductsContext(): ProductsContextType {
  const context = useContext(ProductsContext);
  if (context === undefined) {
    if (import.meta.env.DEV) {
      logger.warn(
        '[ProductsContext] useProductsContext called outside ProductsProvider — using fallback. ' +
          'This usually indicates an HMR module-duplication race; a full reload should fix it.',
      );
    }
    return FALLBACK_CONTEXT;
  }
  return context;
}

/**
 * Safe consumer — returns null when outside ProductsProvider, instead of using the fallback.
 * Use this for components that may render in trees without the provider (e.g. global
 * floating bars rendered above route boundaries, or modal portals) and that prefer to
 * branch on null themselves rather than rely on the no-op fallback.
 *
 * Example:
 *   const ctx = useProductsContextSafe();
 *   const data = ctx?.getProductsByIds(ids) ?? [];
 */
export function useProductsContextSafe(): ProductsContextType | null {
  return useContext(ProductsContext) ?? null;
}
