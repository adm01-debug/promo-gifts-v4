/**
 * Shared inStock predicate — single source of truth for both applyProductFilters
 * (Super Filtro) and useCatalogFiltering (Index catalog).
 *
 * THREE-WAY STATUS EVALUATION (the definitive approach):
 *   1. Known AVAILABLE statuses: 'in-stock' | 'low-stock'  → true
 *   2. Known UNAVAILABLE status: 'out-of-stock'            → false
 *   3. Unknown / other-domain:   anything else             → fall through to stock check
 *
 * This means:
 *   - 'in-stock', 'low-stock'           → true  (catalog available)
 *   - 'out-of-stock', 'OUT-OF-STOCK'    → false (catalog unavailable, case-insensitive)
 *   - 'in_stock', 'critical', 'pending' → fallthrough → isPositiveFiniteStock(stock)
 *     Inventory-domain underscores and unknown statuses defer to raw stock count.
 *
 * Comparison is case-insensitive (GAP-STOCK-CASE-01).
 * Fallback uses Number.isFinite (GAP-STOCK-FRAC-01 / BUG-STOCK-INF-01).
 */
export interface InStockProduct {
  variations?: Array<{
    stock?: number | null;
    /** Pre-computed status (catalog domain, hyphen). Takes priority when recognized. */
    stockStatus?: string | null;
  }> | null;
  stockStatus?: string | null;
  stock?: number | null;
}

/** All valid catalog-domain stock statuses (lowercase with hyphens). */
export const CATALOG_STOCK_STATUSES = ['in-stock', 'low-stock', 'out-of-stock'] as const;
export type CatalogStockStatusValue = (typeof CATALOG_STOCK_STATUSES)[number];

/** Canonical out-of-stock token (exported for consumers). */
export const OUT_OF_STOCK: CatalogStockStatusValue = 'out-of-stock';

/** Statuses that explicitly indicate availability (catalog domain). */
const AVAILABLE_STATUSES = new Set<string>(['in-stock', 'low-stock']);

/** The normalized out-of-stock string (lowercase). */
const OUT_OF_STOCK_NORMALIZED = 'out-of-stock';

/**
 * Type guard: returns true if value is a recognized catalog stock status.
 * Useful at API/data boundaries to validate incoming status values.
 *
 * @example
 * const raw = apiResponse.stockStatus;
 * const status = isCatalogStockStatus(raw) ? raw : getCatalogStockStatus(product.stock);
 */
export function isCatalogStockStatus(value: unknown): value is CatalogStockStatusValue {
  return (
    typeof value === 'string' &&
    (CATALOG_STOCK_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Returns true if stock is a finite positive number.
 * Handles null, undefined, NaN, Infinity, -Infinity and negatives consistently
 * with getCatalogStockStatus (which also uses Number.isFinite internally).
 */
function isPositiveFiniteStock(stock: number | null | undefined): boolean {
  return Number.isFinite(stock) && (stock as number) > 0;
}

/**
 * THREE-WAY evaluation of a single stockStatus string:
 *   true  → explicitly available (in-stock | low-stock)
 *   false → explicitly unavailable (out-of-stock)
 *   null  → unknown / other-domain → caller should fall through to stock check
 *
 * Case-insensitive: 'OUT-OF-STOCK', 'Low-Stock', etc. are handled.
 */
function evaluateStatus(status: string): boolean | null {
  const normalized = status.toLowerCase();
  if (AVAILABLE_STATUSES.has(normalized)) return true;
  if (normalized === OUT_OF_STOCK_NORMALIZED) return false;
  return null; // unknown (e.g. 'in_stock', 'critical', 'pending') → fallthrough
}

/**
 * Returns true if the product can be ordered.
 *
 * For each item (variation or product-level):
 *  1. stockStatus recognized → three-way result (true | false).
 *  2. stockStatus unknown (null result) → isPositiveFiniteStock(stock).
 *  3. No stockStatus → isPositiveFiniteStock(stock).
 *
 * For variation-bearing products: ANY orderable variation makes it available.
 */
export function isProductInStock(product: InStockProduct): boolean {
  if (product.variations && product.variations.length > 0) {
    return product.variations.some((v) => {
      if (v.stockStatus) {
        const r = evaluateStatus(v.stockStatus);
        if (r !== null) return r;
      }
      return isPositiveFiniteStock(v.stock);
    });
  }
  if (product.stockStatus) {
    const r = evaluateStatus(product.stockStatus);
    if (r !== null) return r;
  }
  return isPositiveFiniteStock(product.stock);
}

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes stockStatus for a single variation given the product-level minQuantity.
 * Mirrors getCatalogStockStatus logic to guarantee zero divergence.
 *
 * Usage in data pipeline (product mapper, stockFetcher):
 * ```ts
 * variation.stockStatus = getVariationStockStatus(
 *   variation.stock,
 *   product.minQuantity,
 * );
 * ```
 */
export function getVariationStockStatus(
  variationStock: number | null | undefined,
  productMinQuantity: number | null | undefined,
  lowStockThreshold = 10,
): CatalogStockStatusValue {
  const qty =
    typeof variationStock === 'number' && Number.isFinite(variationStock)
      ? variationStock
      : 0;
  if (qty <= 0) return OUT_OF_STOCK;
  if (
    typeof productMinQuantity === 'number' &&
    Number.isFinite(productMinQuantity) &&
    productMinQuantity >= 1 &&
    qty < productMinQuantity
  ) {
    return OUT_OF_STOCK;
  }
  if (qty < lowStockThreshold) return 'low-stock';
  return 'in-stock';
}

// ─────────────────────────────────────────────────────────────────────────────
// SORTING UTILITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Comparator for sorting products by stock availability.
 *
 * Order: in-stock (0) → low-stock (1) → unknown/other (2) → out-of-stock (3)
 *
 * Case-insensitive. Null/undefined status treated as unknown (rank 2).
 *
 * Usage:
 * ```ts
 * products.sort((a, b) =>
 *   compareStockStatus(a.stockStatus, b.stockStatus)
 * );
 * ```
 */
export function compareStockStatus(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  return stockStatusRank(a) - stockStatusRank(b);
}

/** Returns numeric rank for a stock status (lower = more available). */
export function stockStatusRank(status: string | null | undefined): number {
  if (typeof status !== 'string') return 2; // null/undefined → unknown
  switch (status.toLowerCase()) {
    case 'in-stock':    return 0;
    case 'low-stock':   return 1;
    case 'out-of-stock': return 3;
    default:            return 2; // unknown / other-domain
  }
}
