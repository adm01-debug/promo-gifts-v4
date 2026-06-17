import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetch product_id counts from quote_items to rank "best sellers" internally.
 * Shared between Catalog and Super Filter pages.
 * Uses a 5-minute cache to minimize database load.
 */
export function usePromoSalesRanking() {
  return useQuery({
    queryKey: ['promo-sales-ranking'],
    queryFn: async () => {
      const { data, error } = await supabase.from('quote_items').select('product_id, quantity');

      if (error) throw error;

      const map = new Map<string, number>();
      for (const row of data ?? []) {
        if (!row.product_id) continue;
        map.set(row.product_id, (map.get(row.product_id) || 0) + (row.quantity || 1));
      }
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });
}
