/**
 * Shared inStock predicate — single source of truth for both applyProductFilters
 * (Super Filtro) and useCatalogFiltering (Index catalog).
 *
 * Rule: prefer stockStatus (pre-computed, respects min_quantity) over raw stock.
 * Variation-level check: any variation with stock > 0 keeps the product visible.
 */
export interface InStockProduct {
  variations?: Array<{ stock?: number | null }> | null;
  stockStatus?: string | null;
  stock?: number | null;
}

export function isProductInStock(product: InStockProduct): boolean {
  if (product.variations && product.variations.length > 0)
    return product.variations.some((v) => (v.stock ?? 0) > 0);
  return product.stockStatus ? product.stockStatus !== 'out-of-stock' : (product.stock || 0) > 0;
}
