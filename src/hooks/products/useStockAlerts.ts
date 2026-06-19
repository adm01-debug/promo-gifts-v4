import { dbInvoke, shouldRetry } from '@/lib/db/postgrest';
import { useQuery } from '@tanstack/react-query';
import { getProductImageUrl, type PromobrindProduct } from '@/lib/external-db/product-types';

export type AlertLevel = 'low' | 'critical' | 'out';

export interface StockAlert {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  imageUrl: string | null;
  currentStock: number;
  alertLevel: AlertLevel;
  supplier: string;
}

const STOCK_ALERT_SELECT =
  'id, name, sku, stock_quantity, min_quantity, brand, primary_image_url, images';

export function useStockAlerts(lowStockThreshold = 50, criticalStockThreshold = 10) {
  return useQuery<StockAlert[]>({
    queryKey: ['stock-alerts', lowStockThreshold, criticalStockThreshold],
    queryFn: async () => {
      const result = await dbInvoke<PromobrindProduct>({
        table: 'products',
        operation: 'select',
        select: STOCK_ALERT_SELECT,
        filters: {
          is_active: true,
          // FIX: era `lt.${lowStockThreshold}` (string) que dbInvoke tratava como
          // .eq(col, 'lt.50') → PostgREST gerava stock_quantity=eq.lt.50 → 400.
          // Agora usa objeto de operador que dbInvoke sabe traduzir para .lt()
          stock_quantity: { op: 'lt', value: lowStockThreshold },
        },
        orderBy: { column: 'stock_quantity', ascending: true },
        limit: 50,
      });

      return result.records.map((p) => {
        const stock = p.stock_quantity ?? 0;
        let alertLevel: AlertLevel = 'low';
        if (stock === 0) alertLevel = 'out';
        else if (stock <= criticalStockThreshold) alertLevel = 'critical';

        return {
          id: `stock-${p.id}`,
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          imageUrl: getProductImageUrl(p),
          currentStock: stock,
          alertLevel,
          supplier: p.brand ?? '',
        };
      });
    },
    staleTime: 5 * 60 * 1000,
    // FIX: era retry: 2 — retentava 400 Bad Request (erro do cliente) 3x.
    // shouldRetry só retenta 5xx (erros do servidor), nunca 4xx.
    retry: shouldRetry,
  });
}
