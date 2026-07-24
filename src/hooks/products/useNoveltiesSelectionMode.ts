/**
 * useNoveltiesSelectionMode — Bulk-selection hook for the Novidades module.
 *
 * Thin wrapper around useEntitySelectionMode<NoveltyWithDetails>. Supplies
 * the entity → Product converter; everything else lives in the generic.
 */
import { type NoveltyWithDetails, type Product } from '@/hooks/products';
import { useEntitySelectionMode } from '@/hooks/common';

interface UseNoveltiesSelectionModeParams {
  selectionMode: boolean;
  filteredProducts: NoveltyWithDetails[];
}

/**
 * Converts NoveltyWithDetails to Product (minimum fields required by BulkVariantWizard).
 */
export function noveltyToProduct(n: NoveltyWithDetails): Product {
  return {
    id: n.product_id,
    name: n.product_name,
    description: n.product_description,
    shortDescription: n.product_description || '',
    category_id: n.category_id,
    category_name: n.category_name,
    price: n.base_price || 0,
    image_url: n.product_image || undefined,
    images: n.product_image ? [n.product_image] : [],
    sku: n.product_sku || '',
    // FIX: usar estoque real da novidade (antes era hardcoded 0, contradizendo
    // stockStatus 'in-stock'). stock_quantity e stock_status vêm de toNovelty().
    stock: n.stock_quantity,
    created_at: n.detected_at,
    colors: [],
    materials: [],
    supplier_reference: n.supplier_product_code,
    brand: null,
    is_active: n.is_active,
    minQuantity: n.min_quantity || 1,
    stockStatus: n.stock_status,
    featured: n.is_highlighted,
    newArrival: true,
    onSale: false,
    isKit: false,
    gender: null,
    category: { id: n.category_id || '', name: n.category_name || '' },
    supplier: { id: n.supplier_id || '', name: n.supplier_name || '' },
    tags: {
      publicoAlvo: [],
      datasComemorativas: [],
      endomarketing: [],
      ramo: [],
      nicho: [],
    },
  };
}

export function useNoveltiesSelectionMode({
  selectionMode,
  filteredProducts,
}: UseNoveltiesSelectionModeParams) {
  const sel = useEntitySelectionMode<NoveltyWithDetails>({
    selectionMode,
    filteredProducts,
    entityToProduct: noveltyToProduct,
  });

  // Original hook also exposed `noveltyToProduct` in its return shape for
  // legacy callers; preserve that for backwards compatibility.
  return { ...sel, noveltyToProduct };
}
