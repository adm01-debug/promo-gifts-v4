/**
 * useProducts — Product data hooks
 *
 * Hooks for fetching products from the external catalog.
 * Types and utilities are extracted to dedicated modules but
 * re-exported here for backward compatibility with 29+ consumers.
 */
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { productService } from '@/services/productService';
import type { Product, ProductFilters } from '@/types/product-catalog';

import { logger } from '@/lib/logger';
// Re-export types for backward compatibility
export type { Product, ProductColor, ProductFilters } from '@/types/product-catalog';
export { findKnownHex } from '@/utils/product-colors';
export { mapPromobrindToProduct } from '@/utils/product-mapper';

/**
 * Hook para buscar todos os produtos do catálogo externo.
 */
export function useProducts(
  filters?: ProductFilters,
  options?: Omit<UseQueryOptions<Product[]>, 'queryFn' | 'queryKey'>,
) {
  return useQuery<Product[]>({
    queryKey: ['promobrind-products', filters],
    queryFn: async ({ signal }) => {
      try {
        return await productService.fetchProducts(filters, { signal });
      } catch (error) {
        logger.error('[useProducts] Error fetching products:', error);
        throw error;
      }
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options,
  });
}

/**
 * Hook para buscar um produto específico por ID.
 */
export function useProduct(id: string) {
  return useQuery<Product | null>({
    queryKey: ['promobrind-product', id],
    queryFn: () => productService.fetchProductById(id),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    enabled: !!id,
  });
}

/**
 * Hook leve para produtos relacionados.
 */
export function useRelatedProducts(product: Product | null | undefined, limit = 20) {
  return useQuery<Product[]>({
    queryKey: ['related-products', product?.id, limit],
    queryFn: () => (product ? productService.fetchRelatedProducts(product, limit) : []),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!product,
  });
}
