/**
 * useProducts — Product data hooks
 */
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { productService } from '@/services/productService';
import type { Product, ProductFilters } from '@/types/product-catalog';
import { logger } from '@/lib/logger';
export type { Product, ProductColor, ProductFilters } from '@/types/product-catalog';
export { findKnownHex } from '@/utils/product-colors';
export { mapPromobrindToProduct } from '@/utils/product-mapper';

/**
 * Retorna true se o erro é um AbortError do browser/React Query.
 * TESTADO via bateria F01-H04 (2026-06-23).
 * GAP-H04 FIX: usa 'AbortError: ' (com colon+espaço) para evitar falso positivo.
 */
export function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (err instanceof Error && err.name === 'AbortError') return true;
  // Supabase wrapper — 'AbortError: ' com colon+espaço para evitar GAP-H04
  if (err instanceof Error && err.message?.startsWith('AbortError: ')) return true;
  return false;
}

export function useProducts(
  filters?: ProductFilters,
  options?: Omit<UseQueryOptions<Product[]>, 'queryFn' | 'queryKey'>,
) {
  // Extrair callbacks do consumer ANTES do merge — permite wrapping correto (GAP-G03)
  const consumerThrowOnError = options?.throwOnError;
  const consumerRetry = options?.retry;

  return useQuery<Product[]>({
    queryKey: ['promobrind-products', filters],
    queryFn: async ({ signal }) => {
      try {
        return await productService.fetchProducts(filters, { signal });
      } catch (error) {
        if (isAbortError(error)) throw error; // silencioso — DnD unmount esperado
        logger.error('[useProducts] Error fetching products:', error);
        throw error;
      }
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // Consumer options primeiro (permite override de staleTime, enabled, etc)
    ...options,
    // CRÍTICO: sobrescrever DEPOIS do spread (GAP-G03 fix)
    // AbortError NUNCA deve fazer retry ou ir para ErrorBoundary,
    // mesmo que consumer passe { throwOnError: true, retry: 5 }
    retry: (failureCount: number, error: unknown): boolean => {
      if (isAbortError(error)) return false;
      if (typeof consumerRetry === 'function') return consumerRetry(failureCount, error);
      if (typeof consumerRetry === 'number') return failureCount < consumerRetry;
      if (consumerRetry === false) return false;
      return failureCount < 3;
    },
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    throwOnError: (error: unknown): boolean => {
      if (isAbortError(error)) return false;
      if (typeof consumerThrowOnError === 'function') return consumerThrowOnError(error);
      if (typeof consumerThrowOnError === 'boolean') return consumerThrowOnError;
      return true;
    },
  });
}

export function useProduct(id: string) {
  return useQuery<Product | null>({
    queryKey: ['promobrind-product', id],
    queryFn: () => productService.fetchProductById(id),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10000),
    enabled: !!id,
  });
}

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
