import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Aggregates quantity from order_items (closed orders) over the last 90 days,
 * grouped by product_id. Used by Super Filter to filter products that sold at
 * least X units in the Promo Brindes module.
 *
 * BUG-PROMO-90D-01 FIX (2026-06-21 catalog audit):
 * Previous version did a full client-side table scan of order_items
 * (.select('product_id, quantity, created_at').gte('created_at', ...))
 * transmitting potentially tens of thousands of rows to the browser to
 * aggregate in JS. Same anti-pattern fixed in get_promo_sales_ranking
 * (quote_items) on 2026-06-18.
 *
 * Current version uses the RPC get_promo_sales_90d_by_product() that:
 *   - Does SUM(quantity) GROUP BY product_id server-side
 *   - Filters only rows with quantity > 0 and within 90-day window
 *   - Returns only {product_id, total_qty} — minimal payload
 *   - Graceful fallback: error → empty Map (catalog works without ranking)
 */
export function usePromoSales90dByProduct() {
  return useQuery({
    queryKey: ['promo-sales-90d-by-product-v2'],
    queryFn: async (): Promise<Map<string, number>> => {
      try {
        const { data, error } = await (
          supabase as unknown as {
            rpc: (name: string) => Promise<{ data: unknown; error: unknown }>;
          }
        ).rpc('get_promo_sales_90d_by_product');

        if (error) {
          logger.warn('[usePromoSales90dByProduct] RPC error, returning empty map:', error);
          return new Map();
        }

        const rows = (data as Array<{ product_id: string; total_qty: number }> | null) ?? [];
        const map = new Map<string, number>();
        for (const row of rows) {
          if (row.product_id) {
            map.set(row.product_id, Number(row.total_qty) || 0);
          }
        }

        logger.info(`[usePromoSales90dByProduct] Loaded ${map.size} products from RPC`);
        return map;
      } catch (err) {
        logger.warn('[usePromoSales90dByProduct] Exception, returning empty map:', err);
        return new Map();
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: false, // Falha silenciosa — catálogo funciona sem ranking
  });
}
