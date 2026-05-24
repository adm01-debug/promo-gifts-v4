import { useQuery } from '@tanstack/react-query';
import { invokeExternalDb } from '@/lib/external-db';

export interface VariantWithStock {
  id: string;
  product_id: string;
  sku: string;
  color_code: string | null;
  color_name: string | null;
  color_hex: string | null;
  stock_quantity: number | null;
  next_entry_date: string | null;
  next_entry_quantity: number | null;
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

      const result = await invokeExternalDb<{
        id: string;
        product_id: string;
        sku: string;
        color_code: string | null;
        color_name: string | null;
        color_hex: string | null;
        stock_quantity: number | null;
        selected_thumbnail: string | null;
      }>({
        table: 'product_variants',
        operation: 'select',
        select:
          'id, product_id, sku, color_code, color_name, color_hex, stock_quantity, selected_thumbnail',
        filters: { product_id: productId, is_active: true },
        limit: 200,
      });

      // Map to VariantWithStock (next_entry fields come from variant_supplier_sources if available)
      return result.records.map((v) => ({
        ...v,
        next_entry_date: null,
        next_entry_quantity: null,
      }));
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

  const entryCountByVariant = new Map<string, number>();
  for (const v of variants) {
    if (v.next_entry_date && v.next_entry_quantity && v.next_entry_quantity > 0) {
      const idx = (entryCountByVariant.get(v.id) ?? 0) + 1;
      entryCountByVariant.set(v.id, idx);
      entries.push({
        id: `${v.id}-${idx}`,
        variantId: v.id,
        colorName: v.color_name || 'Sem cor',
        colorHex: v.color_hex,
        expectedDate: v.next_entry_date,
        expectedQuantity: v.next_entry_quantity,
        thumbnail: v.selected_thumbnail,
        supplierSku: v.sku,
        currentStock: v.stock_quantity ?? 0,
        reservedStock: 0,
        entryIndex: idx,
      });
    }
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
