/**
 * Shared inStock predicate — single source of truth for both applyProductFilters
 * (Super Filtro) and useCatalogFiltering (Index catalog).
 *
 * Rule: prefer stockStatus (pre-computed, respects min_quantity) over raw stock.
 *
 * stockStatus convention: lowercase with hyphens ('in-stock' | 'low-stock' | 'out-of-stock').
 * Comparison is case-insensitive to tolerate upstream casing inconsistencies.
 *
 * Fallback (no stockStatus): Number.isFinite(stock) && stock > 0.
 * This correctly handles null, undefined, NaN, Infinity, -Infinity, negative values.
 * Aligns with getCatalogStockStatus (which also uses Number.isFinite internally).
 *
 * ⚠️ Domain boundary: the inventory domain uses underscore notation
 * ('in_stock' | 'out_of_stock' | 'critical') — deliberately NOT handled here.
 */
export interface InStockProduct {
  variations?: Array<{
    stock?: number | null;
    /** Pre-computed status (catalog domain, hyphen). Takes priority over stock when set. */
    stockStatus?: string | null;
  }> | null;
  stockStatus?: string | null;
  stock?: number | null;
}

/** Canonical out-of-stock token (catalog domain, hyphen convention). */
const OUT_OF_STOCK = 'out-of-stock';

/**
 * Returns true if stock is a finite positive number.
 * Handles null, undefined, NaN, Infinity, -Infinity and negative values consistently
 * with getCatalogStockStatus.
 */
function isPositiveFiniteStock(stock: number | null | undefined): boolean {
  return Number.isFinite(stock) && (stock as number) > 0;
}

/**
 * Returns true if the product can be ordered.
 *
 * Priority for each variation / product:
 *  1. stockStatus set → case-insensitive !== 'out-of-stock'
 *  2. No stockStatus → isPositiveFiniteStock(stock) — handles NaN/Infinity/null/neg
 *
 * For variation-bearing products: ANY orderable variation makes the product available.
 */
export function isProductInStock(product: InStockProduct): boolean {
  if (product.variations && product.variations.length > 0)
    return product.variations.some((v) =>
      v.stockStatus
        ? v.stockStatus.toLowerCase() !== OUT_OF_STOCK
        : isPositiveFiniteStock(v.stock),
    );
  if (product.stockStatus)
    return product.stockStatus.toLowerCase() !== OUT_OF_STOCK;
  return isPositiveFiniteStock(product.stock);
}

/** The literal token used for out-of-stock (exported for consumers). */
export { OUT_OF_STOCK };
