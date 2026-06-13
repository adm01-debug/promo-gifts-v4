/**
 * Hook para ranking de vendas internas (Promo Brindes) nos últimos 90 dias.
 * Agrega `order_items.quantity` por `product_id` filtrando por
 * `order_items.created_at >= now() - 90d` (pedidos fechados).
 *
 * Diferente do `usePromoSalesRanking` (que usa quote_items all-time para sorting),
 * este é o hook canônico para o FILTRO "Vendas Promo Brindes 90d" do Super Filtro.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const PROMO_SALES_WINDOW_DAYS = 90;

export function usePromoSales90dByProduct() {
  return useQuery({
    queryKey: ['promo-sales-90d-by-product'],
    queryFn: async (): Promise<Map<string, number>> => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - PROMO_SALES_WINDOW_DAYS);

      const { data, error } = await supabase
        .from('order_items')
        .select('product_id, quantity, created_at')
        .gte('created_at', cutoff.toISOString());

      if (error) throw error;

      const map = new Map<string, number>();
      for (const row of data || []) {
        if (!row.product_id) continue;
        map.set(row.product_id, (map.get(row.product_id) || 0) + (row.quantity || 0));
      }
      return map;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
