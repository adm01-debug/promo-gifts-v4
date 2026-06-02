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
  error: string | null;
  fetchProducts: (ids: string[]) => Promise<void>;
  getProduct: (id: string) => Product | undefined;
  invalidateCache: () => void;
}

const ProductsContext = createContext<ProductsContextType | null>(null);

interface ProductsProviderProps {
  children: ReactNode;
}

export function ProductsProvider({ children }: ProductsProviderProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedIdsRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<Set<string>>(new Set());

  if (isDuplicateModule) {
    logger.warn(
      '[ProductsContext] Multiple module instances detected. ' +
      'This may cause stale data or hydration mismatches in HMR.',
    );
  }

  const fetchProducts = useCallback(async (ids: string[]) => {
    const newIds = ids.filter(
      (id) => !fetchedIdsRef.current.has(id) && !pendingRef.current.has(id),
    );
    if (!newIds.length) return;

    newIds.forEach((id) => pendingRef.current.add(id));
    setIsLoading(true);
    setError(null);

    try {
      const raw = await fetchPromobrindProducts(newIds);
      const mapped = raw.map(mapPromobrindToProduct);

      setProducts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const next = [...prev];
        for (const p of mapped) {
          if (!existingIds.has(p.id)) next.push(p);
        }
        return next;
      });

      newIds.forEach((id) => {
        fetchedIdsRef.current.add(id);
        pendingRef.current.delete(id);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch products';
      setError(msg);
      newIds.forEach((id) => pendingRef.current.delete(id));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getProduct = useCallback(
    (id: string) => products.find((p) => p.id === id),
    [products],
  );

  const invalidateCache = useCallback(() => {
    fetchedIdsRef.current.clear();
    pendingRef.current.clear();
    setProducts([]);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({ products, isLoading, error, fetchProducts, getProduct, invalidateCache }),
    [products, isLoading, error, fetchProducts, getProduct, invalidateCache],
  );

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error('useProducts must be used within ProductsProvider');
  return ctx;
}
