import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { QUERY_KEY_PREFIXES, PRODUTOS_QUERY_OPTIONS } from '@/lib/query-config';
import { productService } from '@/services/productService';

export function usePrefetchProduct() {
  const queryClient = useQueryClient();

  const prefetchProduct = useCallback(
    async (productId: string) => {
      await queryClient.prefetchQuery({
        queryKey: [QUERY_KEY_PREFIXES.PRODUTO_PERSONALIZACAO, productId],
        queryFn: () => productService.fetchProductById(productId),
        ...PRODUTOS_QUERY_OPTIONS,
        // Only prefetch if we don't have the data or it's stale
        staleTime: 5 * 60 * 1000,
      });
    },
    [queryClient],
  );

  return { prefetchProduct };
}
