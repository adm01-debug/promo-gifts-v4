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
  includeFutureStock: boolean;
  futureCutoffMs: number; // 0 quando desativado
  minQtyIncludesFutureStock: boolean;
}


export function buildFilterContext(filters: StockFilters): FilterContext {
  const colorName = filters.colorName?.trim() || undefined;
  const colorGroupN = normalize(filters.colorGroup);
  const includeFutureStock = Boolean(filters.includeFutureStock);
  const windowDays = filters.futureStockWindowDays ?? 15;
  return {
    searchN: normalize(filters.search),
    colorName,
    colorNameN: normalize(colorName),
    colorGroupN,
    categoryN: normalize(filters.categoryId),
    supplierN: normalize(filters.supplierId),
    minQty: filters.minQuantityNeeded ?? 0,
    hasVariantFilter: Boolean(colorName) || Boolean(filters.colorGroup),
    includeFutureStock,
    futureCutoffMs: includeFutureStock ? Date.now() + windowDays * 86_400_000 : 0,
    minQtyIncludesFutureStock: Boolean(filters.minQtyIncludesFutureStock),
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

function futureWithinWindow(v: VariantStock, cutoffMs: number): number {
  if (!v.futureStock || v.futureStock <= 0) return 0;
  const dateStr = v.expectedReplenishDate ?? v.futureStockDate;
  if (!dateStr) return 0;
  const t = Date.parse(dateStr);
  if (Number.isNaN(t) || t > cutoffMs) return 0;
  return v.futureStock;
}

function matchMinQuantity(
  product: ProductStockSummary,
  variantsForFilter: VariantStock[],
  ctx: FilterContext,
): boolean {
  if (ctx.minQty <= 0) return true;
  // Regra de negócio (PT-BR): "Preciso de X un…" é sempre estrito sobre o
  // estoque DISPONÍVEL AGORA (availableStock). O toggle "Estoque Futuro"
  // controla apenas a exibição da coluna/stat de reposição — não deve inflar
  // o pool da régua de quantidade, sob pena de listar produtos como
  // "0 un / Esgotado" passando por um filtro de ≥ X.
  const pool = ctx.hasVariantFilter
    ? variantsForFilter.reduce((sum, v) => sum + Math.max(0, v.availableStock), 0)
    : Math.max(0, product.totalAvailableStock);
  return pool >= ctx.minQty;
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

  // Pré-seleção via interseção de índices (fast path). Aplica todos os filtros
  // discretos disponíveis (cor exata, grupo de cor, categoria, fornecedor) antes
  // de varrer linearmente — mantém O(min(idx)) em vez de O(N).
  const idSets: Set<string>[] = [];
  if (ctx.colorNameN) {
    const s = idx.byColorNameN.get(ctx.colorNameN);
    if (!s || s.size === 0) return [];
    idSets.push(s);
  }
  if (ctx.colorGroupN && !ctx.colorNameN) {
    const s = idx.byColorGroupN.get(ctx.colorGroupN);
    // colorGroup pode bater por substring em colorName → fallback p/ scan se sem índice.
    if (s && s.size > 0) idSets.push(s);
  }
  if (ctx.categoryN) {
    const s = idx.byCategoryN.get(ctx.categoryN);
    if (!s || s.size === 0) return [];
    idSets.push(s);
  }
  if (ctx.supplierN) {
    const s = idx.bySupplierN.get(ctx.supplierN);
    if (!s || s.size === 0) return [];
    idSets.push(s);
  }

  let candidates: ProductStockSummary[] = products;
  if (idSets.length > 0) {
    // menor set primeiro para minimizar interseção
    idSets.sort((a, b) => a.size - b.size);
    const [first, ...rest] = idSets;
    const allowed = new Set<string>();
    for (const id of first) {
      if (rest.every((s) => s.has(id))) allowed.add(id);
    }
    if (allowed.size === 0) return [];
    candidates = products.filter((p) => allowed.has(p.productId));
  }

  const out: ProductStockSummary[] = [];
  for (const p of candidates) {
    const variantsForFilter = selectMatchingVariants(p, ctx);
    if (ctx.hasVariantFilter && variantsForFilter.length === 0) continue;
    if (!matchStatus(p, variantsForFilter, filters.status, ctx.hasVariantFilter)) continue;
    if (!matchSearch(p, variantsForFilter, ctx.searchN)) continue;
    if (ctx.categoryN && normalize(p.categoryName) !== ctx.categoryN) continue;
    if (ctx.supplierN && normalize(p.supplierName) !== ctx.supplierN) continue;
    if (!matchMinQuantity(p, variantsForFilter, ctx)) continue;
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
