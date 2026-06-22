/**
 * Shared inStock predicate — single source of truth for both applyProductFilters
 * (Super Filtro) and useCatalogFiltering (Index catalog).
 *
 * Rule: prefer stockStatus (pre-computed, respects min_quantity) over raw stock.
 * Variation-level check: any variation with stock > 0 keeps the product visible.
 *
 * stockStatus convention: lowercase with hyphens ('in-stock' | 'low-stock' | 'out-of-stock').
 * The comparison is case-insensitive to tolerate upstream casing inconsistencies
 * (e.g. 'OUT-OF-STOCK' from a legacy integration or misconfigured cache).
 *
 * ⚠️ Domain boundary: the inventory domain uses underscore notation
 * ('in_stock' | 'out_of_stock' | 'critical'). Those values are NOT treated
 * as 'out-of-stock' here — the two domains are deliberately separate.
 */
export interface InStockProduct {
  variations?: Array<{ stock?: number | null }> | null;
  stockStatus?: string | null;
  stock?: number | null;
}

/** Canonical out-of-stock token (catalog domain, hyphen convention). */
const OUT_OF_STOCK = 'out-of-stock';

/**
 * Returns true if the product can be ordered (has enough stock to meet
 * minimum order quantity, as encoded in stockStatus).
 *
 * Priority:
 *  1. If variations exist → any variation with stock > 0 passes.
 *  2. If stockStatus is set → case-insensitive comparison with 'out-of-stock'.
 *  3. Fallback → raw stock > 0 (legacy data without pre-computed status).
 */
export function isProductInStock(product: InStockProduct): boolean {
  if (product.variations && product.variations.length > 0)
    return product.variations.some((v) => (v.stock ?? 0) > 0);
  if (product.stockStatus)
    return product.stockStatus.toLowerCase() !== OUT_OF_STOCK;
  return (product.stock || 0) > 0;
}

/** The literal token used for out-of-stock (exported for consumers). */
export { OUT_OF_STOCK };
