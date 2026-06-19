/**
 * useReplenishmentsSelectionMode — Bulk-selection hook for the Reposição module.
 *
 * Thin wrapper around useEntitySelectionMode<ReplenishmentWithDetails>.
 * Supplies the entity → Product converter; everything else lives in the generic.
 */
import type { Product, ReplenishmentWithDetails } from '@/hooks/products';
import { useEntitySelectionMode } from '@/hooks/common';

interface UseReplenishmentsSelectionModeParams {
  selectionMode: boolean;
  filteredProducts: ReplenishmentWithDetails[];
}

/**
 * Converts ReplenishmentWithDetails to Product (minimum fields required by BulkVariantWizard).
 *
 * Exported because callers in `VirtualizedReplenishmentList.tsx` and
 * `ReplenishmentProductGrid.tsx` import this directly.
 */
export function replenishmentToProduct(n: ReplenishmentWithDetails): Product {
  return {
    id: n.product_id,
    name: n.product_name,
    description: n.product_description,
    category_id: n.category_id,
    category_name: n.category_name,
    price: n.base_price || 0,
    image_url: n.product_image || undefined,
    images: n.product_image ? [n.product_image] : [],
    sku: n.product_sku ?? '',
    stock: 0,
    created_at: n.created_at,
    colors: [],
    materials: [],
    supplier_reference: n.supplier_product_code,
    brand: null,
    is_active: n.is_active,
    minQuantity: 1,
    stockStatus: 'in-stock',
    featured: n.is_highlighted,
    newArrival: false,
    onSale: false,
    isKit: false,
    gender: null,
    category: { id: n.category_id ?? '', name: n.category_name ?? '' },
    supplier: { id: n.supplier_id ?? '', name: n.supplier_name ?? '' },
    tags: {
      publicoAlvo: [],
      datasComemorativas: [],
      endomarketing: [],
      ramo: [],
      nicho: [],
    },
  };
}

export function useReplenishmentsSelectionMode({
  selectionMode,
  filteredProducts,
}: UseReplenishmentsSelectionModeParams) {
  return useEntitySelectionMode<ReplenishmentWithDetails>({
    selectionMode,
    filteredProducts,
    entityToProduct: replenishmentToProduct,
  });
}
