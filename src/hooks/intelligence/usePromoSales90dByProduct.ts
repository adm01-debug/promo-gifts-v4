import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Aggregates quantity from order_items (closed orders) over the last 90 days,
 * grouped by product_id. Used by Super Filter to filter products that sold at
 * least X units in the Promo Brindes module.
 *
 * Read-only client-side query — no new tables/functions created.
 */
export function usePromoSales90dByProduct() {
  return useQuery({
    queryKey: ['promo-sales-90d-by-product'],
    queryFn: async (): Promise<Map<string, number>> => {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const { data, error } = await supabase
        .from('order_items')
        .select('product_id, quantity, created_at')
        .gte('created_at', since.toISOString());

      if (error) {
        logger.warn('[usePromoSales90dByProduct] query failed', { error: error.message });
        return new Map();
      }

      const map = new Map<string, number>();
      for (const row of data ?? []) {
        if (!row.product_id) continue;
        const q = row.quantity || 0;
        if (q <= 0) continue;
        map.set(row.product_id, (map.get(row.product_id) || 0) + q);
      }
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });
}
