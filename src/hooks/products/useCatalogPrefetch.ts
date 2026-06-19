import { dbInvoke } from '@/lib/db/postgrest';
import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchPromobrindCategories } from '@/lib/external-db/products-detail';
import {
  CATALOG_BATCH_PAGES,
  CATALOG_PAGE_SIZE,
  mapLightweightToProduct,
  PRODUCT_SELECT_LIGHTWEIGHT,
} from '@/hooks/products/useProductsLightweight';

export function prefetchCatalog(queryClient: QueryClient) {
  return queryClient.prefetchInfiniteQuery({
    queryKey: ['promobrind-products-catalog', ''],
    queryFn: async () => {
      const batchQueries = Array.from({ length: CATALOG_BATCH_PAGES }, (_, i) => ({
        table: 'products',
        operation: 'select' as const,
        select: PRODUCT_SELECT_LIGHTWEIGHT,
        filters: { active: true },
        orderBy: { column: 'name', ascending: true },
        limit: CATALOG_PAGE_SIZE,
        offset: i * CATALOG_PAGE_SIZE,
        ...(i === 0 ? { countMode: 'exact' as const } : {}),
      }));
      const [batchResults, categoriesRaw] = await Promise.all([
        Promise.all(batchQueries.map((q) => dbInvoke(q))),
        fetchPromobrindCategories().catch(() => [] as Array<{ id: string; name: string }>),
      ]);
      const categoriesById = new Map(categoriesRaw.map((c) => [String(c.id), c.name]));
      const products: Array<ReturnType<typeof mapLightweightToProduct>> = [];
      let totalEstimate: number | null = null;
      let lastPageSize = 0;

      // FIX-CATALOG-01 (2026-06-01): same InvokeResult shape fix as useProductsLightweight.
      // batchResults is InvokeResult<T>[] from dbInvoke — shape is { records, count }.
      for (const result of batchResults) {
        if (result.records && result.records.length > 0) {
          products.push(
            ...result.records.map((p) =>
              mapLightweightToProduct(
                p as Parameters<typeof mapLightweightToProduct>[0],
                categoriesById,
              ),
            ),
          );
          lastPageSize = result.records.length;
          if (result.count !== null && totalEstimate === null) {
            totalEstimate = result.count;
          }
        } else if (result.records) {
          lastPageSize = 0;
        }
      }

      return {
        products,
        nextOffset:
          lastPageSize === CATALOG_PAGE_SIZE ? CATALOG_BATCH_PAGES * CATALOG_PAGE_SIZE : null,
        totalEstimate,
      };
    },
    initialPageParam: 0,
    staleTime: 30 * 60 * 1000,
  });
}

export function useCatalogPrefetch() {
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const prefetchedRef = useRef(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || prefetchedRef.current) return;
    const timer = setTimeout(() => {
      prefetchedRef.current = true;
      prefetchCatalog(queryClient);
    }, 400);
    return () => clearTimeout(timer);
  }, [isAuthenticated, isLoading, queryClient]);
}
