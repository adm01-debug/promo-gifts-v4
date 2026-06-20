/**
 * useProductMatch — Finds matching products based on category, tags, nicho, and complementary relationships.
 *
 * Scoring:
 * - Same category: +30
 * - Shared tags (público, datas, endomarketing): +10 each
 * - Shared nicho/ramo: +15 each
 * - Same supplier: +5
 * - Complementary name keywords: +20
 */
import { useMemo } from 'react';
import type { Product } from '@/types/product-catalog';

/** Produto correspondente com pontuação de relevância e motivos do match. */
export interface MatchResult {
  product: Product;
  score: number;
  reasons: string[];
  matchType: 'identical' | 'similar' | 'complementary';
}

// Complementary product keyword pairs (Portuguese)
const COMPLEMENTARY_PAIRS: [string[], string[]][] = [
  [
    ['tábua', 'tabua'],
    ['faca', 'garfo', 'espeto', 'pegador'],
  ],
  [['caneta'], ['caderno', 'agenda', 'bloco', 'estojo']],
  [
    ['garrafa', 'squeeze', 'copo'],
    ['canudo', 'tampa', 'abridor'],
  ],
  [
    ['mochila', 'bolsa', 'mala'],
    ['necessaire', 'estojo', 'porta'],
  ],
  [
    ['camiseta', 'camisa'],
    ['boné', 'bone', 'chapéu'],
  ],
  [
    ['mouse', 'teclado'],
    ['mousepad', 'hub', 'suporte'],
  ],
  [
    ['carregador', 'powerbank'],
    ['cabo', 'adaptador'],
  ],
  [
    ['vinho', 'cerveja'],
    ['abridor', 'saca-rolha', 'taça', 'copo'],
  ],
  [['churrasco'], ['avental', 'tábua', 'tabua', 'faca', 'espeto', 'pegador', 'grelha']],
  [
    ['café', 'cafe'],
    ['xícara', 'caneca', 'copo', 'coador'],
  ],
  [['toalha'], ['roupão', 'chinelo', 'necessaire']],
  [['cadeira'], ['almofada', 'encosto', 'apoio']],
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function findComplementaryKeywords(name: string): string[] {
  const normalized = normalizeText(name);
  const complements: string[] = [];

  for (const [groupA, groupB] of COMPLEMENTARY_PAIRS) {
    if (groupA.some((kw) => normalized.includes(normalizeText(kw)))) {
      complements.push(...groupB);
    }
    if (groupB.some((kw) => normalized.includes(normalizeText(kw)))) {
      complements.push(...groupA);
    }
  }
  return complements;
}

const MATCH_TAG_LABELS: Record<string, string> = {
  publicoAlvo: 'Público-alvo',
  datasComemorativas: 'Data comemorativa',
  endomarketing: 'Endomarketing',
} as const;

function calculateMatchScore(
  source: Product,
  candidate: Product,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Same category
  if (source.category_id && candidate.category_id && source.category_id === candidate.category_id) {
    score += 30;
    reasons.push('Mesma categoria');
  }

  // Shared tags
  const tagCategories: (keyof Product['tags'])[] = [
    'publicoAlvo',
    'datasComemorativas',
    'endomarketing',
  ];
  for (const tagCat of tagCategories) {
    const srcTags = (source.tags?.[tagCat] ?? []).map((t) => t.trim().toLowerCase());
    const candTags = (candidate.tags?.[tagCat] ?? []).map((t) => t.trim().toLowerCase());
    const shared = srcTags.filter((t) => t && candTags.includes(t));
    if (shared.length > 0) {
      score += 10 * shared.length;
      reasons.push(`${MATCH_TAG_LABELS[tagCat]}: ${shared.join(', ')}`);
    }
  }

  // Shared nicho/ramo
  const srcNiches = [...(source.tags?.nicho ?? []), ...(source.tags?.ramo ?? [])].map((n) =>
    n.trim().toLowerCase(),
  );
  const candNiches = [...(candidate.tags?.nicho ?? []), ...(candidate.tags?.ramo ?? [])].map((n) =>
    n.trim().toLowerCase(),
  );
  const sharedNiches = srcNiches.filter((n) => n && candNiches.includes(n));
  if (sharedNiches.length > 0) {
    score += 15 * sharedNiches.length;
    reasons.push(`Nicho: ${sharedNiches.join(', ')}`);
  }

  // Same supplier
  if (
    source.supplier?.id &&
    candidate.supplier?.id &&
    source.supplier.id === candidate.supplier.id
  ) {
    score += 5;
    reasons.push('Mesmo fornecedor');
  }

  // Complementary name keywords (exclude self-matching)
  const complements = findComplementaryKeywords(source.name);
  if (complements.length > 0) {
    const candNormalized = normalizeText(candidate.name);
    const sourceNormalized = normalizeText(source.name);
    const matchedKeywords = complements.filter((kw) => {
      const kwNorm = normalizeText(kw);
      // Only count if keyword matches candidate but NOT source (avoid self-match)
      return candNormalized.includes(kwNorm) && !sourceNormalized.includes(kwNorm);
    });
    if (matchedKeywords.length > 0) {
      score += 20 * matchedKeywords.length;
      reasons.push(`Complementar: ${matchedKeywords.join(', ')}`);
    }
  }

  return { score, reasons };
}

function getMatchType(
  score: number,
  isSameCategory: boolean,
  hasComplementary: boolean,
): MatchResult['matchType'] {
  if (hasComplementary) return 'complementary';
  if (isSameCategory && score >= 40) return 'identical';
  return 'similar';
}

/** Filtros para limitar quais produtos correspondentes são retornados pelo hook. */
export interface MatchFilters {
  minScore: number;
  matchTypes: MatchResult['matchType'][];
  categoryFilter?: string;
  supplierFilter?: string;
  onlyInStock: boolean;
}

const DEFAULT_FILTERS: MatchFilters = {
  minScore: 10,
  matchTypes: ['identical', 'similar', 'complementary'],
  onlyInStock: false,
};

/** Retorna produtos similares/complementares ordenados por pontuação de relevância. */
export function useProductMatch(
  sourceProduct: Product | null,
  allProducts: Product[],
  filters: Partial<MatchFilters> = {},
): { matches: MatchResult[]; isProcessing: boolean } {
  const mergedFilters: MatchFilters = { ...DEFAULT_FILTERS, ...filters };
  const matchTypesKey = (mergedFilters.matchTypes || []).join(',');

  const matches = useMemo(() => {
    if (!sourceProduct || allProducts.length === 0) return [];

    const results: MatchResult[] = [];

    for (const candidate of allProducts) {
      if (candidate.id === sourceProduct.id) continue;

      // Pre-filters
      if (mergedFilters.onlyInStock && candidate.stockStatus === 'out-of-stock') continue;
      if (mergedFilters.categoryFilter && candidate.category?.name !== mergedFilters.categoryFilter)
        continue;
      if (mergedFilters.supplierFilter && candidate.supplier?.name !== mergedFilters.supplierFilter)
        continue;

      const { score, reasons } = calculateMatchScore(sourceProduct, candidate);
      if (score < mergedFilters.minScore) continue;

      const isSameCategory = sourceProduct.category_id === candidate.category_id;
      const hasComplementary = reasons.some((r) => r.startsWith('Complementar'));
      const matchType = getMatchType(score, isSameCategory, hasComplementary);

      if (!mergedFilters.matchTypes.includes(matchType)) continue;

      results.push({ product: candidate, score, reasons, matchType });
    }

    return results.sort((a, b) => b.score - a.score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sourceProduct,
    allProducts,
    mergedFilters.minScore,
    matchTypesKey,
    mergedFilters.categoryFilter,
    mergedFilters.supplierFilter,
    mergedFilters.onlyInStock,
  ]);

  return { matches, isProcessing: false };
}
