import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ProductStat {
  sku: string | null;
  name: string;
  image: string | null;
  totalQuantity: number;
  totalValue: number;
  orderCount: number;
}

export function useClientTopProducts(clientId?: string) {
  return useQuery({
    queryKey: ['client-top-products', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data: orders } = await supabase
        // rls-allow: filtrado por client_id; RLS aplica seller scope
        .from('orders')
        .select('id')
        .eq('client_id', clientId);

      if (!orders?.length) return [];

      const orderIds = orders.map((o) => o.id);

      const { data: items } = await supabase
        .from('order_items')
        .select('product_sku, product_name, product_image_url, quantity, unit_price')
        .in('order_id', orderIds);

      if (!items?.length) return [];

      const productStats = items.reduce<Record<string, ProductStat>>((acc, item) => {
        const key = item.product_sku || item.product_name;
        if (!key) return acc;
        if (!acc[key]) {
          acc[key] = {
            sku: item.product_sku,
            name: item.product_name ?? '',
            image: item.product_image_url,
            totalQuantity: 0,
            totalValue: 0,
            orderCount: 0,
          };
        }
        acc[key].totalQuantity += item.quantity ?? 0;
        acc[key].totalValue += (item.quantity ?? 0) * (item.unit_price ?? 0);
        acc[key].orderCount++;
        return acc;
      }, {});

      return Object.values(productStats)
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 10);
    },
    enabled: !!clientId,
    staleTime: 10 * 60 * 1000,
  });
}
