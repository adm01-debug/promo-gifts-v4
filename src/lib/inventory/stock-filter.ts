/**
 * stock-filter — SSOT puro para filtragem/agregação do dashboard de Estoque.
 *
 * Pipeline em 3 estágios bem separados:
 *   1. selectMatchingVariants(product, ctx) → subset de variações que casam com cor/grupo
 *   2. aggregateVariantTotals(variants)     → recálculo dos totais do produto
 *   3. applyStockFilters(products, filters, alerts, indexes?)
 *        → orquestrador (variant filter → status → search → produto → minQty → alerts → projeção → sort)
 *
 * Otimizações:
 *   - normalize() (lowercase + strip de acentos) memoizado por chamada
 *   - buildStockIndexes() pré-computa índices por cor/categoria/fornecedor/produto
 *     para reuso entre filtros e paginação (evita varrer N×M).
 */
import {
  aggregateVariantsToProduct,
  type ProductStockSummary,
  type StockFilters,
  type StockAlert,
  type VariantStock,
  type StockStatus,
} from '@/types/stock';

// ---------- normalização ----------
export const normalize = (s: string | undefined | null): string =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

// ---------- contexto derivado dos filtros ----------
export interface FilterContext {
  searchN: string;
  colorName?: string;
  colorNameN: string;
  colorGroupN: string;
  categoryN: string;
  supplierN: string;
  minQty: number;
  hasVariantFilter: boolean;
}


export function buildFilterContext(filters: StockFilters): FilterContext {
  const colorName = filters.colorName?.trim() || undefined;
  const colorGroupN = normalize(filters.colorGroup);
  return {
    searchN: normalize(filters.search),
    colorName,
    colorNameN: normalize(colorName),
    colorGroupN,
    categoryN: normalize(filters.categoryId),
    supplierN: normalize(filters.supplierId),
    minQty: filters.minQuantityNeeded ?? 0,
    hasVariantFilter: Boolean(colorName) || Boolean(filters.colorGroup),
  };
}


// ---------- estágio 1: seleção de variações ----------
export function selectMatchingVariants(
  product: ProductStockSummary,
  ctx: FilterContext,
): VariantStock[] {
  if (!ctx.hasVariantFilter) return product.variants;
  return product.variants.filter((v) => {
    const cn = normalize(v.colorName);
    const cg = normalize(v.colorGroup);
    if (ctx.colorNameN && cn !== ctx.colorNameN) return false;
    if (ctx.colorGroupN && !cn.includes(ctx.colorGroupN) && !cg.includes(ctx.colorGroupN)) return false;
    return true;
  });
}

// ---------- estágio 2: agregação ----------
export interface VariantTotals {
  totalVariants: number;
  totalCurrentStock: number;
  totalMinStock: number;
  totalReservedStock: number;
  totalInTransitStock: number;
  totalAvailableStock: number;
}

export function aggregateVariantTotals(variants: VariantStock[]): VariantTotals {
  return variants.reduce<VariantTotals>(
    (acc, v) => {
      acc.totalVariants += 1;
      acc.totalCurrentStock += v.currentStock;
      acc.totalMinStock += v.minStock;
      acc.totalReservedStock += v.reservedStock;
      acc.totalInTransitStock += v.inTransitStock;
      acc.totalAvailableStock += v.availableStock;
      return acc;
    },
    {
      totalVariants: 0,
      totalCurrentStock: 0,
      totalMinStock: 0,
      totalReservedStock: 0,
      totalInTransitStock: 0,
      totalAvailableStock: 0,
    },
  );
}

export function projectProduct(
  product: ProductStockSummary,
  variants: VariantStock[],
): ProductStockSummary {
  if (variants.length === product.variants.length) return product;
  return { ...product, ...aggregateVariantsToProduct(variants) };
}

// ---------- estágio 0: índices reutilizáveis ----------
export interface StockIndexes {
  byColorNameN: Map<string, Set<string>>; // colorN → productIds
  byColorGroupN: Map<string, Set<string>>; // tokens da cor → productIds (inclui substrings de colorGroup)
  byCategoryN: Map<string, Set<string>>; // categoryN → productIds
  bySupplierN: Map<string, Set<string>>; // supplierN → productIds
  productsWithAlerts: Set<string>;
}

export function buildStockIndexes(
  products: ProductStockSummary[],
  alerts: StockAlert[],
): StockIndexes {
  const byColorNameN = new Map<string, Set<string>>();
  const byColorGroupN = new Map<string, Set<string>>();
  const byCategoryN = new Map<string, Set<string>>();
  const bySupplierN = new Map<string, Set<string>>();
  const addTo = (m: Map<string, Set<string>>, key: string, id: string) => {
    if (!key) return;
    let set = m.get(key);
    if (!set) {
      set = new Set();
      m.set(key, set);
    }
    set.add(id);
  };
  for (const p of products) {
    addTo(byCategoryN, normalize(p.categoryName), p.productId);
    addTo(bySupplierN, normalize(p.supplierName), p.productId);
    for (const v of p.variants) {
      const cn = normalize(v.colorName);
      addTo(byColorNameN, cn, p.productId);
      const cg = normalize(v.colorGroup);
      if (cg) addTo(byColorGroupN, cg, p.productId);
    }
  }
  const productsWithAlerts = new Set(alerts.map((a) => a.productId));
  return { byColorNameN, byColorGroupN, byCategoryN, bySupplierN, productsWithAlerts };
}


// ---------- predicados auxiliares ----------
function matchStatus(
  product: ProductStockSummary,
  variantsForFilter: VariantStock[],
  status: StockStatus | 'all',
  hasVariantFilter: boolean,
): boolean {
  if (status === 'all') return true;
  if (status === 'incoming') {
    if (hasVariantFilter) {
      return variantsForFilter.some((v) => v.status === 'incoming' || v.inTransitStock > 0);
    }
    return (
      product.totalInTransitStock > 0 ||
      variantsForFilter.some((v) => v.status === 'incoming' || v.inTransitStock > 0)
    );
  }
  if (hasVariantFilter) {
    return variantsForFilter.some(
      (v) => v.status === status || (status === 'low_stock' && v.status === 'critical'),
    );
  }
  if (product.overallStatus === status) return true;
  if (status === 'low_stock' && product.overallStatus === 'critical') return true;
  return product.variants.some((v) => v.status === status);
}

function matchSearch(
  product: ProductStockSummary,
  variantsForFilter: VariantStock[],
  searchN: string,
): boolean {
  if (!searchN) return true;
  if (normalize(product.productName).includes(searchN)) return true;
  if (normalize(product.productSku).includes(searchN)) return true;
  return variantsForFilter.some(
    (v) => normalize(v.colorName).includes(searchN) || normalize(v.variantSku).includes(searchN),
  );
}

function matchMinQuantity(
  product: ProductStockSummary,
  variantsForFilter: VariantStock[],
  minQty: number,
  hasVariantFilter: boolean,
): boolean {
  if (minQty <= 0) return true;
  const pool = hasVariantFilter
    ? variantsForFilter.reduce((sum, v) => sum + v.availableStock, 0)
    : product.totalAvailableStock;
  return pool >= minQty;
}

// ---------- estágio 3: orquestrador ----------
export function applyStockFilters(
  products: ProductStockSummary[],
  filters: StockFilters,
  alerts: StockAlert[],
  indexes?: StockIndexes,
): ProductStockSummary[] {
  const ctx = buildFilterContext(filters);
  const idx = indexes ?? buildStockIndexes(products, alerts);

  // Pré-seleção via índice de cor (fast path quando filtro de cor exata é usado).
  let candidates: ProductStockSummary[] = products;
  if (ctx.hasVariantFilter && ctx.colorNameN && !ctx.colorGroupN) {
    const ids = idx.byColorNameN.get(ctx.colorNameN);
    if (!ids || ids.size === 0) return [];
    candidates = products.filter((p) => ids.has(p.productId));
  }

  const out: ProductStockSummary[] = [];
  for (const p of candidates) {
    const variantsForFilter = selectMatchingVariants(p, ctx);
    if (ctx.hasVariantFilter && variantsForFilter.length === 0) continue;
    if (!matchStatus(p, variantsForFilter, filters.status, ctx.hasVariantFilter)) continue;
    if (!matchSearch(p, variantsForFilter, ctx.searchN)) continue;
    if (filters.categoryId && p.categoryName !== filters.categoryId) continue;
    if (filters.supplierId && p.supplierName !== filters.supplierId) continue;
    if (!matchMinQuantity(p, variantsForFilter, ctx.minQty, ctx.hasVariantFilter)) continue;
    if (filters.showOnlyWithAlerts && !idx.productsWithAlerts.has(p.productId)) continue;
    out.push(ctx.hasVariantFilter ? projectProduct(p, variantsForFilter) : p);
  }

  return sortProducts(out, filters);
}

// ---------- ordenação ----------
export function sortProducts(
  items: ProductStockSummary[],
  filters: Pick<StockFilters, 'sortBy' | 'sortDirection'>,
): ProductStockSummary[] {
  const dir = filters.sortDirection === 'asc' ? 1 : -1;
  const out = [...items];
  switch (filters.sortBy) {
    case 'name':
      out.sort((a, b) => a.productName.localeCompare(b.productName) * dir);
      break;
    case 'sku':
      out.sort((a, b) => a.productSku.localeCompare(b.productSku) * dir);
      break;
    case 'stock_quantity':
      out.sort((a, b) => (a.totalCurrentStock - b.totalCurrentStock) * dir);
      break;
    case 'available_stock':
      out.sort((a, b) => (a.totalAvailableStock - b.totalAvailableStock) * dir);
      break;
    case 'days_remaining':
      out.sort(
        (a, b) => ((a.daysUntilFullStockout ?? 999) - (b.daysUntilFullStockout ?? 999)) * dir,
      );
      break;
  }
  return out;
}
