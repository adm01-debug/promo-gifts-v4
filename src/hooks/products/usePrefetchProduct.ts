import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { QUERY_KEY_PREFIXES, PRODUTOS_QUERY_OPTIONS } from '@/lib/constants';
import { productService } from '@/lib/product-service';

export function usePrefetchProduct() {
  const queryClient = useQueryClient();

  return useCallback(async (productId: string) => {
    queryClient.prefetchQuery({
      queryKey: [QUERY_KEY_PREFIXES.PRODUTO_PERSONALIZACAO, productId],
      queryFn: () => productService.fetchProductById(productId),
      ...PRODUTOS_QUERY_OPTIONS,
      // Only prefetch if we don't have the data or it's stale
      staleTime: 5 * 60 * 1000, 
    });
  }, [queryClient]);
}
