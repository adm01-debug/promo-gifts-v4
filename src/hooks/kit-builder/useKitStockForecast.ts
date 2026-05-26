/**
 * useKitStockForecast — calcula data ideal de fechamento do kit
 * com base nas previsões de reposição (variant_supplier_sources) dos itens.
 */
import { useQuery } from '@tanstack/react-query';
import { invokeExternalDb } from '@/lib/external-db';
import type { KitItem } from '@/lib/kit-builder';

export interface KitStockForecast {
  idealClosingDate: string | null;
  bufferDays: number;
  itemsAtRisk: Array<{
    itemId: string;
    itemName: string;
    deficit: number;
    nextEntryDate: string | null;
    nextEntryQty: number;
  }>;
  ready: boolean;
}

const BUFFER_DAYS = 3;

export function useKitStockForecast(items: KitItem[], kitQuantity: number) {
  return useQuery({
    queryKey: [
      'kit-stock-forecast',
      items.map((i) => `${i.id}:${i.quantity}`).join('|'),
      kitQuantity,
    ],
    queryFn: async (): Promise<KitStockForecast> => {
      if (items.length === 0)
        return { idealClosingDate: null, bufferDays: BUFFER_DAYS, itemsAtRisk: [], ready: true };

      const productIds = Array.from(new Set(items.map((i) => i.id).filter(Boolean)));
      if (productIds.length === 0)
        return { idealClosingDate: null, bufferDays: BUFFER_DAYS, itemsAtRisk: [], ready: true };

      // Busca fontes de fornecimento
      const result = await invokeExternalDb<{
        product_id: string;
        stock_quantity: number | null;
        next_entry_date: string | null;
        next_entry_quantity: number | null;
      }>({
        table: 'variant_supplier_sources',
        operation: 'select',
        select: 'product_id, stock_quantity, next_entry_date, next_entry_quantity',
        filters: { product_id: productIds, is_active: true },
        limit: 500,
      }).catch(() => ({ records: [] }));

      const stockByProduct = new Map<
        string,
        { current: number; nextDate: string | null; nextQty: number }
      >();
      for (const r of result.records) {
        const cur = stockByProduct.get(r.product_id) || { current: 0, nextDate: null, nextQty: 0 };
        cur.current += r.stock_quantity || 0;
        if (r.next_entry_date && (!cur.nextDate || r.next_entry_date < cur.nextDate)) {
          cur.nextDate = r.next_entry_date;
          cur.nextQty = r.next_entry_quantity || 0;
        }
        stockByProduct.set(r.product_id, cur);
      }

      const itemsAtRisk: KitStockForecast['itemsAtRisk'] = [];
      let maxNextDate: string | null = null;

      for (const it of items) {
        const required = it.quantity * kitQuantity;
        const stock = stockByProduct.get(it.id) || { current: 0, nextDate: null, nextQty: 0 };
        const deficit = required - stock.current;
        if (deficit > 0) {
          itemsAtRisk.push({
            itemId: it.id,
            itemName: it.name,
            deficit,
            nextEntryDate: stock.nextDate,
            nextEntryQty: stock.nextQty,
          });
          if (stock.nextDate && (!maxNextDate || stock.nextDate > maxNextDate)) {
            maxNextDate = stock.nextDate;
          }
        }
      }

      // Calcula data ideal: max(next_entry) + buffer
      let idealClosingDate: string | null = null;
      if (maxNextDate) {
        const d = new Date(maxNextDate);
        d.setDate(d.getDate() + BUFFER_DAYS);
        idealClosingDate = d.toISOString().slice(0, 10);
      }

      return {
        idealClosingDate,
        bufferDays: BUFFER_DAYS,
        itemsAtRisk,
        ready: itemsAtRisk.length === 0,
      };
    },
    enabled: items.length > 0,
    staleTime: 2 * 60 * 1000,
  });
}
