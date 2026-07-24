import { useMemo } from 'react';
import { type Product, useProducts } from '@/hooks/products';

/** Opções de ranking/filtragem para o comparador. */
export type SupplierComparisonSort = 'commonColors' | 'leadTime' | 'price' | 'score' | 'stock';

export interface SupplierComparisonOptions {
  /** Mostra apenas fornecedores com produto ativo (proxy de "verificado"). */
  onlyVerified?: boolean;
  /** Critério de ordenação das alternativas. Default: 'score'. */
  sortBy?: SupplierComparisonSort;
  /** Similaridade mínima de nome (0..1). Default: 0.4. */
  minNameSimilarity?: number;
}

interface SupplierProduct {
  product: Product;
  /** Δ absoluto de preço (alt - base). Negativo = mais barato. */
  priceDiff: number;
  /** Δ percentual de preço relativo ao base. */
  priceDiffPercent: number;
  /** Estoque maior que o base. */
  stockAdvantage: boolean;
  isLowestPrice: boolean;
  isBestStock: boolean;
  /** Cores em comum com o produto base (interseção por nome normalizado). */
  commonColors: string[];
  /** Materiais em comum com o produto base. */
  commonMaterials: string[];
  /** Lead time em dias (pode ser nulo). */
  leadTimeDays: number | null;
  /** Heurística "ativo/verificado" — usa product.is_active. */
  isVerified: boolean;
  /** Score composto 0-100 (maior = melhor). */
  score: number;
  /** Detalhamento do score por critério */
  scoreBreakdown: Record<string, number>;
  /** Economia projetada por pedido considerando o MOQ efetivo. */
  economiaPorMOQ: number;
  /** MOQ efetivo usado no cálculo de economia (max entre base e alt). */
  effectiveMOQ: number;
}

interface SupplierComparisonResult {
  baseProduct: Product;
  /** Alternativas já filtradas e ordenadas conforme `options`. */
  alternatives: SupplierProduct[];
  /** Alternativas sem o filtro `onlyVerified` aplicado (útil pra UI). */
  alternativesUnfiltered: SupplierProduct[];
  lowestPrice: number;
  highestStock: number;
  priceRange: { min: number; max: number };
  /** Maior economia projetada por pedido (considerando MOQ). */
  maxEconomiaPorMOQ: number;
  /** Menor lead time entre todas as alternativas válidas. */
  fastestLeadTimeDays: number | null;
}

/* -------------------------------------------------------------------------- */
/*  Hook                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Compara um produto com alternativas de outros fornecedores.
 * Busca por categoria server-side (evita carregar 6000+ produtos) e aplica
 * matching por nome normalizado + bônus de subcategoria e materiais.
 */
export function useSupplierComparison(
  product: Product | null | undefined,
  options: SupplierComparisonOptions = {},
) {
  const { onlyVerified = false, sortBy = 'score', minNameSimilarity = 0.4 } = options;

  const categoryName = product?.category?.name;
  const categoryId = product?.category?.id;
  const { data: categoryProductsRaw, isLoading } = useProducts(
    categoryId
      ? { categoryId, limit: 1000 }
      : categoryName
        ? { category: categoryName, limit: 1000 }
        : undefined,
    { enabled: !!product && (!!categoryId || !!categoryName), staleTime: 10 * 60 * 1000 },
  );
  const categoryProducts = useMemo(() => categoryProductsRaw ?? [], [categoryProductsRaw]);

  const result = useMemo((): SupplierComparisonResult | null => {
    if (!product || categoryProducts.length === 0) return null;

    const baseProduct = product;
    const baseTokens = tokenize(baseProduct.name);
    const baseColors = normalizeColorNames(baseProduct.colors);
    const baseMaterials = normalizeMaterials(baseProduct.materials);
    const baseSubcategory = baseProduct.subcategory?.toLowerCase().trim() ?? '';

    // Filtra similares (outro fornecedor, mesma categoria, similaridade mínima)
    const similarProducts = categoryProducts.filter((p: Product) => {
      if (p.id === baseProduct.id) return false;
      if (p.supplier.id === baseProduct.supplier.id) return false;
      if (p.category.id !== baseProduct.category.id) return false;
      if (p.price <= 0) return false; // Ignora produtos com preço zero ou negativo (erro de dados)

      const pTokens = tokenize(p.name);
      const sim = nameSimilarity(baseTokens, pTokens);
      const subBonus =
        baseSubcategory && p.subcategory?.toLowerCase().trim() === baseSubcategory ? 0.15 : 0;
      const matBonus = jaccard(baseMaterials, normalizeMaterials(p.materials)) > 0 ? 0.1 : 0;

      return sim + subBonus + matBonus >= minNameSimilarity;
    });

    if (similarProducts.length === 0) return null;

    const allProducts = [baseProduct, ...similarProducts];
    const lowestPrice = Math.min(...allProducts.map((p) => p.price));
    const highestStock = Math.max(...allProducts.map((p) => p.stock));
    const priceRange = { min: lowestPrice, max: Math.max(...allProducts.map((p) => p.price)) };

    const baseMOQ = baseProduct.minQuantity ?? 1;

    const rawAlternatives: SupplierProduct[] = similarProducts.map((alt) => {
      const priceDiff = alt.price - baseProduct.price;
      const priceDiffPercent = baseProduct.price > 0 ? (priceDiff / baseProduct.price) * 100 : 0;
      const altColors = normalizeColorNames(alt.colors);
      const altMaterials = normalizeMaterials(alt.materials);
      const commonColors = intersect(baseColors, altColors);
      const commonMaterials = intersect(baseMaterials, altMaterials);
      const leadTimeDays = typeof alt.leadTimeDays === 'number' ? alt.leadTimeDays : null;
      const altMOQ = alt.minQuantity ?? 1;
      const effectiveMOQ = Math.max(baseMOQ, altMOQ);
      const economiaPorMOQ = priceDiff < 0 ? Math.abs(priceDiff) * effectiveMOQ : 0;
      const isVerified = alt.is_active !== false;

      return {
        product: alt,
        priceDiff,
        priceDiffPercent,
        stockAdvantage: alt.stock > baseProduct.stock,
        isLowestPrice: alt.price === lowestPrice,
        isBestStock: alt.stock === highestStock,
        commonColors,
        commonMaterials,
        leadTimeDays,
        isVerified,
        economiaPorMOQ,
        effectiveMOQ,
        score: 0,
        scoreBreakdown: {},
      };
    });

    // Score composto — calculado depois de termos o range completo
    const maxLead = Math.max(
      ...rawAlternatives
        .map((a) => a.leadTimeDays ?? Number.POSITIVE_INFINITY)
        .filter((n) => Number.isFinite(n)),
      1,
    );
    const maxCommonColors = Math.max(...rawAlternatives.map((a) => a.commonColors.length), 1);

    const withScore = rawAlternatives.map((a) => {
      const breakdown = {
        price: clamp01(0.5 - a.priceDiffPercent / 100) * 35,
        stock: highestStock > 0 ? clamp01(a.product.stock / highestStock) * 20 : 0,
        colors: maxCommonColors > 0 ? clamp01(a.commonColors.length / maxCommonColors) * 15 : 0,
        moq: clamp01(1 - (a.product.minQuantity ?? 1) / 100) * 15,
        lead:
          typeof a.leadTimeDays === 'number' && maxLead > 0
            ? clamp01(1 - a.leadTimeDays / maxLead) * 10
            : 5,
        verified: a.isVerified ? 10 : 0,
      };

      const total = Object.values(breakdown).reduce((acc, val) => acc + val, 0);

      return {
        ...a,
        score: Math.round(total),
        scoreBreakdown: breakdown,
      };
    });

    const alternativesUnfiltered = sortAlternatives(withScore, sortBy);
    const alternatives = onlyVerified
      ? sortAlternatives(
          withScore.filter((a) => a.isVerified),
          sortBy,
        )
      : alternativesUnfiltered;

    const maxEconomiaPorMOQ = Math.max(0, ...alternativesUnfiltered.map((a) => a.economiaPorMOQ));
    const leadTimes = alternativesUnfiltered
      .map((a) => a.leadTimeDays)
      .filter((n): n is number => typeof n === 'number');
    const fastestLeadTimeDays = leadTimes.length ? Math.min(...leadTimes) : null;

    return {
      baseProduct,
      alternatives,
      alternativesUnfiltered,
      lowestPrice,
      highestStock,
      priceRange,
      maxEconomiaPorMOQ,
      fastestLeadTimeDays,
    };
  }, [product, categoryProducts, onlyVerified, sortBy, minNameSimilarity]);

  return { result, isLoading };
}

/* -------------------------------------------------------------------------- */
/*  Utilitário público mantido para compat                                     */
/* -------------------------------------------------------------------------- */

export function getSupplierProductsInCategory(
  products: Product[],
  categoryId: number | string,
): Map<string, Product[]> {
  const supplierMap = new Map<string, Product[]>();
  products.forEach((product) => {
    if (product.category.id !== categoryId) return;
    const supplierId = product.supplier.id;
    let supplierProducts = supplierMap.get(supplierId);
    if (!supplierProducts) {
      supplierProducts = [];
      supplierMap.set(supplierId, supplierProducts);
    }
    supplierProducts.push(product);
  });
  return supplierMap;
}

/* -------------------------------------------------------------------------- */
/*  Helpers internos                                                            */
/* -------------------------------------------------------------------------- */

const STOPWORDS_PT = new Set([
  'a',
  'o',
  'as',
  'os',
  'um',
  'uma',
  'uns',
  'umas',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'para',
  'por',
  'pra',
  'com',
  'sem',
  'sob',
  'sobre',
  'e',
  'ou',
  'que',
  'se',
  'ml',
  'cm',
  'mm',
  'kg',
  'g',
]);

/* -------------------------------------------------------------------------- */
/*  Exported for testing purposes only                                        */
/* -------------------------------------------------------------------------- */

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function tokenize(input: string | null | undefined): Set<string> {
  if (!input) return new Set();
  return new Set(
    stripAccents(input)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => {
        // Permite palavras > 2 caracteres que não são stopwords
        if (w.length > 2) return !STOPWORDS_PT.has(w);
        // Permite palavras de 2 caracteres se contiverem números (ex: A4, 5G, 2L, 1m)
        if (w.length === 2) return /[0-9]/.test(w);
        return false;
      }),
  );
}

export function jaccard(a: Set<string> | string[], b: Set<string> | string[]): number {
  const setA = a instanceof Set ? a : new Set(a);
  const setB = b instanceof Set ? b : new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  setA.forEach((v) => {
    if (setB.has(v)) inter += 1;
  });
  return inter / (setA.size + setB.size - inter);
}

export function nameSimilarity(a: Set<string>, b: Set<string>): number {
  return jaccard(a, b);
}

export function intersect(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter((v) => setB.has(v));
}

export function normalizeColorNames(colors: Product['colors']): string[] {
  if (!Array.isArray(colors)) return [];
  return colors
    .map((c) => (c?.name ? stripAccents(c.name).toLowerCase().trim() : ''))
    .filter(Boolean);
}

export function normalizeMaterials(materials: Product['materials']): string[] {
  if (!Array.isArray(materials)) return [];
  return materials.map((m) => stripAccents(String(m)).toLowerCase().trim()).filter(Boolean);
}

export interface ScoreInput {
  priceDiffPercent: number;
  stock: number;
  highestStock: number;
  leadTimeDays: number | null;
  maxLead: number;
  commonColors: number;
  maxCommonColors: number;
  isVerified: boolean;
}

/**
 * Score composto 0..100.
 * Pesos: preço 40 · estoque 25 · cores em comum 15 · lead time 10 · verificado 10.
 * Mais barato e maior estoque = melhor. Lead time menor = melhor.
 */
export function computeScore(input: ScoreInput): number {
  // Preço: -50% diff = 1.0 ; +50% diff = 0.0
  const priceComponent = clamp01(0.5 - input.priceDiffPercent / 100);
  // Estoque relativo ao maior estoque visto
  const stockComponent = input.highestStock > 0 ? clamp01(input.stock / input.highestStock) : 0;
  // Cores em comum normalizadas
  const colorsComponent =
    input.maxCommonColors > 0 ? clamp01(input.commonColors / input.maxCommonColors) : 0;
  // Lead time: 0 dias = 1.0, maior lead = 0.0
  const leadComponent =
    typeof input.leadTimeDays === 'number' && input.maxLead > 0
      ? clamp01(1 - input.leadTimeDays / input.maxLead)
      : 0.5; // desconhecido = neutro
  const verifiedComponent = input.isVerified ? 1 : 0;

  const score =
    priceComponent * 40 +
    stockComponent * 25 +
    colorsComponent * 15 +
    leadComponent * 10 +
    verifiedComponent * 10;

  return Math.round(score);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function sortAlternatives(
  list: SupplierProduct[],
  sortBy: SupplierComparisonSort,
): SupplierProduct[] {
  const sorted = [...list];
  switch (sortBy) {
    case 'price':
      sorted.sort((a, b) => a.product.price - b.product.price);
      break;
    case 'stock':
      sorted.sort((a, b) => b.product.stock - a.product.stock);
      break;
    case 'leadTime':
      sorted.sort((a, b) => (a.leadTimeDays ?? Infinity) - (b.leadTimeDays ?? Infinity));
      break;
    case 'commonColors':
      sorted.sort((a, b) => b.commonColors.length - a.commonColors.length);
      break;
    case 'score':
    default:
      sorted.sort((a, b) => b.score - a.score);
      break;
  }
  return sorted;
}
