import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface VariantWithStock {
  id: string;
  product_id: string;
  sku: string;
  color_code: string | null;
  color_name: string | null;
  color_hex: string | null;
  stock_quantity: number | null;
  next_entry_date: string | null; // Mapeado para next_date_1 por compatibilidade
  next_entry_quantity: number | null; // Mapeado para next_quantity_1 por compatibilidade
  next_date_1?: string | null;
  next_quantity_1?: number | null;
  next_date_2?: string | null;
  next_quantity_2?: number | null;
  next_date_3?: string | null;
  next_quantity_3?: number | null;
  selected_thumbnail: string | null;
}

export interface StockEntry {
  id: string;
  variantId: string;
  colorName: string;
  colorHex: string | null;
  expectedDate: string;
  expectedQuantity: number;
  thumbnail: string | null;
  supplierSku?: string;
  currentStock?: number;
  reservedStock?: number;
  entryIndex?: number;
}

export interface ColorSummary {
  name: string;
  hex: string | null;
  thumbnail: string | null;
  currentStock: number;
  incomingTotal: number;
  incomingCount: number;
}

/**
 * Busca variantes de um produto com informações de estoque futuro.
 */
export function useProductVariantsWithStock(productId: string | undefined) {
  return useQuery({
    queryKey: ['variant-supplier-sources', productId],
    queryFn: async (): Promise<VariantWithStock[]> => {
      if (!productId) return [];

      const { data, error } = await supabase
        .from('product_variants')
        .select(
          `
          id, product_id, sku, color_code, color_name, color_hex, stock_quantity, selected_thumbnail,
          variant_supplier_sources(next_date_1, next_quantity_1, next_date_2, next_quantity_2, next_date_3, next_quantity_3, is_active)
        `,
        )
        .eq('product_id', productId)
        .eq('is_active', true)
        .limit(200);

      if (error) {
        if (error.message?.includes('410') || error.message?.includes('Gone')) {
          const { reportSilentEmpty } = await import('@/lib/external-db/silent-empty-report');
          reportSilentEmpty({
            reason: 'gone_410',
            table: 'product_variants',
            operation: 'select',
            message: error.message,
          });
          logger.warn('Bridge deprecated (410) for variant sources');
          return [];
        }
        throw error;
      }

      type VariantRow = VariantWithStock & {
        variant_supplier_sources?: Array<{
          next_date_1?: string | null;
          next_quantity_1?: number | null;
          next_date_2?: string | null;
          next_quantity_2?: number | null;
          next_date_3?: string | null;
          next_quantity_3?: number | null;
          is_active?: boolean | null;
        }>;
      };
      const records = (data as unknown as VariantRow[]) || [];

      return records.map((v): VariantWithStock => {
        // Prefer the first active source; fall back to [0] if none are marked active.
        const source =
          v.variant_supplier_sources?.find((s) => s.is_active === true) ??
          v.variant_supplier_sources?.[0];
        return {
          ...v,
          next_entry_date: source?.next_date_1 || null,
          next_entry_quantity: source?.next_quantity_1 || null,
          next_date_1: source?.next_date_1 ?? null,
          next_quantity_1: source?.next_quantity_1 ?? null,
          next_date_2: source?.next_date_2 ?? null,
          next_quantity_2: source?.next_quantity_2 ?? null,
          next_date_3: source?.next_date_3 ?? null,
          next_quantity_3: source?.next_quantity_3 ?? null,
        };
      });
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Processa variantes em entradas de estoque futuro (reposição).
 */
export function processStockEntries(variants: VariantWithStock[]): StockEntry[] {
  const entries: StockEntry[] = [];

  for (const v of variants) {
    const futurePairs = [
      { date: v.next_date_1, qty: v.next_quantity_1 },
      { date: v.next_date_2, qty: v.next_quantity_2 },
      { date: v.next_date_3, qty: v.next_quantity_3 },
    ];

    futurePairs.forEach((pair, idx) => {
      if (pair.date && pair.qty && pair.qty > 0) {
        entries.push({
          id: `${v.id}-${idx + 1}`,
          variantId: v.id,
          colorName: v.color_name || 'Sem cor',
          colorHex: v.color_hex,
          expectedDate: pair.date,
          expectedQuantity: pair.qty,
          thumbnail: v.selected_thumbnail,
          supplierSku: v.sku,
          currentStock: v.stock_quantity ?? 0,
          reservedStock: 0,
          entryIndex: idx + 1,
        });
      }
    });
  }

  return entries;
}

/**
 * Calcula resumo de estoque agrupado por cor.
 */
export function calculateColorSummary(
  variants: VariantWithStock[],
  stockEntries: StockEntry[],
): ColorSummary[] {
  const colorMap = new Map<string, ColorSummary>();

  // Agregar estoque atual por cor
  for (const v of variants) {
    const name = v.color_name || 'Sem cor';
    const existing = colorMap.get(name);
    if (existing) {
      existing.currentStock += v.stock_quantity || 0;
    } else {
      colorMap.set(name, {
        name,
        hex: v.color_hex,
        thumbnail: v.selected_thumbnail,
        currentStock: v.stock_quantity || 0,
        incomingTotal: 0,
        incomingCount: 0,
      });
    }
  }

  // Agregar previsões de reposição por cor
  for (const entry of stockEntries) {
    const existing = colorMap.get(entry.colorName);
    if (existing) {
      existing.incomingTotal += entry.expectedQuantity;
      existing.incomingCount += 1;
      if (!existing.thumbnail && entry.thumbnail) {
        existing.thumbnail = entry.thumbnail;
      }
    }
  }

  return Array.from(colorMap.values());
}
