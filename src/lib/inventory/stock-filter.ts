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
/** Normaliza string para comparação case-insensitive e sem acentos. */
export const normalize = (s: string | undefined | null): string =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

// ---------- contexto derivado dos filtros ----------
/** Valores pré-computados derivados de `StockFilters` para evitar recálculos em loops. */
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

/** Deriva o contexto de filtragem a partir dos filtros brutos, normalizando strings uma única vez. */
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
    // categoryId from the UI is the category name (from StockCategoryTreeSelect).
    // Normalize for case/accent-insensitive matching, consistent with supplierN.
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
/** Retorna apenas as variações do produto que casam com o filtro de cor/grupo (estágio 1). */
export function selectMatchingVariants(
  product: ProductStockSummary,
  ctx: FilterContext,
): VariantStock[] {
  if (!ctx.hasVariantFilter) return product.variants;
  return product.variants.filter((v) => {
    const cn = normalize(v.colorName);
    const cg = normalize(v.colorGroup);
    if (ctx.colorNameN && cn !== ctx.colorNameN) return false;
    if (ctx.colorGroupN && !cn.includes(ctx.colorGroupN) && !cg.includes(ctx.colorGroupN))
      return false;
    return true;
  });
}

// ---------- estágio 2: agregação ----------
/** Totais somados de um subconjunto de variações (resultado do estágio 2). */
export interface VariantTotals {
  totalVariants: number;
  totalCurrentStock: number;
  totalMinStock: number;
  totalReservedStock: number;
  totalInTransitStock: number;
  totalAvailableStock: number;
}

/** Soma os campos de estoque de um array de variações em um único `VariantTotals`. */
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

/** Reconstrói um `ProductStockSummary` com os totais recalculados a partir de um subconjunto de variações. */
export function projectProduct(
  product: ProductStockSummary,
  variants: VariantStock[],
): ProductStockSummary {
  if (variants.length === product.variants.length) return product;
  return { ...product, ...aggregateVariantsToProduct(variants) };
}

// ---------- estágio 0: índices reutilizáveis ----------
/** Índices pré-computados para filtragem O(1) por cor, categoria, fornecedor e alertas. */
export interface StockIndexes {
  byColorNameN: Map<string, Set<string>>; // colorN → productIds
  byColorGroupN: Map<string, Set<string>>; // tokens da cor → productIds (inclui substrings de colorGroup)
  byCategoryN: Map<string, Set<string>>; // categoryN → productIds
  bySupplierN: Map<string, Set<string>>; // supplierN → productIds
  productsWithAlerts: Set<string>;
}

/** Pré-computa índices invertidos sobre a lista de produtos e alertas para reutilização entre chamadas. */
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
    // Normalize categoryId (category name from tree select) for case/accent-insensitive index.
    addTo(byCategoryN, normalize(p.categoryId ?? p.categoryName), p.productId);
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
  // "Crítico" é decisão de PRODUTO (overallStatus) e espelha 1:1 o KPI do card.
  // Variantes nunca recebem status 'critical'; esta guarda torna explícito e
  // impede que um futuro fallback por variante infle o filtro vs. o card.
  if (status === 'critical') return false;
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
  // Caminho preferencial: quando há segmentos granulares (qtd × data),
  // soma APENAS as chegadas cuja data cai dentro da janela. Evita o
  // super/subdimensionamento de colapsar múltiplas datas num único total.
  if (v.futureSegments && v.futureSegments.length > 0) {
    let sum = 0;
    for (const seg of v.futureSegments) {
      const qty = seg?.quantity;
      if (typeof qty !== 'number' || !Number.isFinite(qty) || qty <= 0) continue;
      if (!seg.date) continue;
      const t = Date.parse(seg.date);
      if (Number.isNaN(t) || t > cutoffMs) continue;
      sum += qty;
    }
    return sum;
  }
  // Fallback (contrato de data única): total `futureStock` atrelado a uma só data.
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
  // Por padrão, "Preciso de X un…" é estrito sobre o estoque DISPONÍVEL AGORA.
  // Só soma Estoque Futuro ao pool quando o usuário ATIVAR explicitamente o
  // sub-toggle "Incluir Estoque Futuro no cálculo" E o toggle global de
  // Estoque Futuro também estiver ligado (necessário para definir a janela).
  let pool = ctx.hasVariantFilter
    ? variantsForFilter.reduce((sum, v) => sum + Math.max(0, v.availableStock), 0)
    : Math.max(0, product.totalAvailableStock);
  if (ctx.minQtyIncludesFutureStock && ctx.includeFutureStock) {
    const source = ctx.hasVariantFilter ? variantsForFilter : product.variants;
    for (const v of source) pool += futureWithinWindow(v, ctx.futureCutoffMs);
  }
  return pool >= ctx.minQty;
}

// ---------- estágio 3: orquestrador ----------
/**
 * Pipeline completo de filtragem: índice → variantes → status → busca → categoria →
 * fornecedor → quantidade mínima → alertas → projeção → ordenação.
 */
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
    if (ctx.categoryN && normalize(p.categoryId ?? p.categoryName ?? '') !== ctx.categoryN)
      continue;
    if (ctx.supplierN && normalize(p.supplierName) !== ctx.supplierN) continue;
    if (!matchMinQuantity(p, variantsForFilter, ctx)) continue;
    if (filters.showOnlyWithAlerts && !idx.productsWithAlerts.has(p.productId)) continue;
    out.push(ctx.hasVariantFilter ? projectProduct(p, variantsForFilter) : p);
  }

  return sortProducts(out, filters);
}

// ---------- ordenação ----------
/** Ordena os produtos filtrados pelo critério e direção configurados nos filtros. */
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
