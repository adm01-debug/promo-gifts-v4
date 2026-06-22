/**
 * Shared inStock predicate — single source of truth for both applyProductFilters
 * (Super Filtro) and useCatalogFiltering (Index catalog).
 *
 * Rule: prefer stockStatus (pre-computed, respects min_quantity) over raw stock.
 * Variation-level check: uses variation.stockStatus when present (IMPROVEMENT 2),
 * fallback to (v.stock ?? 0) > 0 for legacy data without pre-computed status.
 *
 * stockStatus convention: lowercase with hyphens ('in-stock' | 'low-stock' | 'out-of-stock').
 * The comparison is case-insensitive to tolerate upstream casing inconsistencies.
 *
 * ⚠️ Domain boundary: the inventory domain uses underscore notation
 * ('in_stock' | 'out_of_stock' | 'critical'). Those values are NOT treated
 * as 'out-of-stock' here — the two domains are deliberately separate.
 */
export interface InStockProduct {
  variations?: Array<{
    stock?: number | null;
    /** Pre-computed status (catalog domain, hyphen). When set, takes priority over stock. */
    stockStatus?: string | null;
  }> | null;
  stockStatus?: string | null;
  stock?: number | null;
}

/** Canonical out-of-stock token (catalog domain, hyphen convention). */
const OUT_OF_STOCK = 'out-of-stock';

/**
 * Returns true if the product can be ordered.
 *
 * Priority:
 *  1. Variations: if stockStatus is set on variation → case-insensitive check.
 *     If no variation.stockStatus → fallback to (v.stock ?? 0) > 0.
 *     ANY variation that passes makes the product available.
 *  2. Product-level stockStatus → case-insensitive comparison.
 *  3. Fallback → raw stock > 0 (legacy data without pre-computed status).
 */
export function isProductInStock(product: InStockProduct): boolean {
  if (product.variations && product.variations.length > 0)
    return product.variations.some((v) =>
      v.stockStatus
        ? v.stockStatus.toLowerCase() !== OUT_OF_STOCK
        : (v.stock ?? 0) > 0,
    );
  if (product.stockStatus)
    return product.stockStatus.toLowerCase() !== OUT_OF_STOCK;
  return (product.stock || 0) > 0;
}

/** The literal token used for out-of-stock (exported for consumers). */
export { OUT_OF_STOCK };
