import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { untypedFrom } from '@/lib/supabase-untyped';

interface ProductInsight {
  totalViews: number;
  totalQuotes: number;
  totalOrders: number;
  conversionRate: number;
  averageQuantity: number;
  topSegments: Array<{
    segment: string;
    count: number;
  }>;
  recentActivity: Array<{
    type: 'view' | 'quote' | 'order';
    date: string;
    details: string;
  }>;
}

export function useProductInsights(_productId?: string, productSku?: string) {
  return useQuery({
    queryKey: ['product-insights', productSku],
    queryFn: async (): Promise<ProductInsight> => {
      if (!productSku) {
        return {
          totalViews: 0,
          totalQuotes: 0,
          totalOrders: 0,
          conversionRate: 0,
          averageQuantity: 0,
          topSegments: [],
          recentActivity: [],
        };
      }

      const [
        { count: viewsCount },
        { data: quoteItems, count: quotesCount },
        { data: orderItems, count: ordersCount },
      ] = await Promise.all([
        untypedFrom('product_views')
          .select('*', { count: 'exact', head: true })
          .eq('product_sku', productSku),
        untypedFrom('quote_items')
          .select('quantity, quote_id', { count: 'exact' })
          .eq('product_sku', productSku),
        untypedFrom('order_items')
          .select('quantity, order_id', { count: 'exact' })
          .eq('product_sku', productSku),
      ]);

      const allQuantities = [
        ...(quoteItems ?? []).map((q) => q.quantity),
        ...(orderItems ?? []).map((o) => o.quantity),
      ];
      const averageQuantity =
        allQuantities.length > 0
          ? allQuantities.reduce((a, b) => a + (b ?? 0), 0) / allQuantities.length
          : 0;

      const conversionRate =
        quotesCount && quotesCount > 0 ? ((ordersCount || 0) / quotesCount) * 100 : 0;

      const orderIds = (orderItems ?? [])
        .map((o) => o.order_id)
        .filter((id): id is string => id !== null);
      let topSegments: ProductInsight['topSegments'] = [];

      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          // rls-allow: seller-scope enforced by RLS policy; orderIds filtered from seller's own items
          .from('orders')
          .select('client_id')
          .in('id', orderIds);

        const clientIds = [...new Set((orders ?? []).map((o) => o.client_id).filter(Boolean))];

        if (clientIds.length > 0) {
          const { selectCrm } = await import('@/lib/crm-db');
          const clients = await selectCrm<{ id: string; ramo_atividade?: string }>('companies', {
            select: 'id, ramo_atividade',
            filters: { id: { in: clientIds } },
          });

          const clientSegmentMap: Record<string, string> = {};
          (clients ?? []).forEach((c: { id?: string; ramo_atividade?: string }) => {
            if (c.ramo_atividade) clientSegmentMap[c.id as string] = c.ramo_atividade;
          });

          const segmentCounts: Record<string, number> = {};
          (orders ?? []).forEach((order) => {
            const segment = order.client_id ? clientSegmentMap[order.client_id] : null;
            if (segment) {
              segmentCounts[segment] = (segmentCounts[segment] ?? 0) + 1;
            }
          });

          topSegments = Object.entries(segmentCounts)
            .map(([segment, count]) => ({ segment, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        }
      }

      const recentActivity: ProductInsight['recentActivity'] = [];

      const [{ data: recentViews }, { data: recentQuotes }] = await Promise.all([
        untypedFrom('product_views')
          .select('created_at, seller_id')
          .eq('product_sku', productSku)
          .order('created_at', { ascending: false })
          .limit(3),
        untypedFrom('quote_items')
          .select('created_at, quantity')
          .eq('product_sku', productSku)
          .order('created_at', { ascending: false })
          .limit(3),
      ]);

      (recentViews ?? []).forEach((v) => {
        recentActivity.push({
          type: 'view',
          date: v.created_at,
          details: 'Visualizado por um vendedor',
        });
      });

      (recentQuotes ?? []).forEach((q) => {
        recentActivity.push({
          type: 'quote',
          date: q.created_at ?? '',
          details: `Adicionado em cotação (${q.quantity} un.)`,
        });
      });

      recentActivity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return {
        totalViews: viewsCount || 0,
        totalQuotes: quotesCount || 0,
        totalOrders: ordersCount || 0,
        conversionRate: Math.round(conversionRate * 10) / 10,
        averageQuantity: Math.round(averageQuantity),
        topSegments,
        recentActivity: recentActivity.slice(0, 5),
      };
    },
    enabled: !!productSku,
    staleTime: 5 * 60 * 1000,
  });
}
