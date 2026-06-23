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
 * Retorna true se o erro é um AbortError do browser.
 *
 * AbortErrors são esperados quando um componente desmonta enquanto o fetch
 * está em curso — em particular quando o @dnd-kit reconcilia a árvore React
 * durante drag/drop (BUG-PRODUCTS-ABORT-DND 2026-06-23).
 * NÃO devem ser logados como erros nem contabilizados para retry.
 */
function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (err instanceof Error && err.name === 'AbortError') return true;
  // Supabase wraps AbortError: { message: 'AbortError: ...' }
  if (err instanceof Error && err.message?.startsWith('AbortError')) return true;
  return false;
}

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
        // BUG-PRODUCTS-ABORT-DND (2026-06-23):
        // AbortError é esperado quando o componente desmonta durante DnD.
        // React Query v5 cancela o fetch via AbortController quando o último
        // observer sai (componente desmonta). NÃO logar — é falso positivo
        // que oculta erros reais no console.
        // Re-throw para que React Query trate internamente (não conta para retry).
        if (isAbortError(error)) {
          throw error;
        }
        logger.error('[useProducts] Error fetching products:', error);
        throw error;
      }
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // AbortErrors não devem contar para retry — React Query v5 já os distingue,
    // mas 'shouldRetryOnError' garante mesmo em edge cases de wrapping.
    retry: (failureCount, error) => {
      if (isAbortError(error)) return false;
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // AbortErrors NÃO devem propagar para ErrorBoundary — são operações
    // esperadas, não falhas do sistema.
    throwOnError: (error) => !isAbortError(error),
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
