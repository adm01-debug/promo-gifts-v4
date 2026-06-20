/**
 * useProductMatch — Finds matching products based on category, descriptive tags,
 * materials, name similarity and complementary relationships.
 *
 * Scoring (additive):
 * - Same category (category_id):                 +30
 * - Shared marketing tag (público/datas/endo):   +10 each
 * - Shared nicho/ramo:                            +15 each
 * - Same supplier:                                +5
 * - Shared descriptive tag (flat `tags`):         +8 each (max 24)
 * - Shared material:                              +6 each (max 12)
 * - Complementary name keyword:                   +20 each
 *
 * Classification:
 * - `complementary` — has at least one complementary keyword match.
 * - `identical`     — very high name-token similarity (≈ same product, e.g. another
 *                     supplier or colour variant).
 * - `similar`       — everything else above the score threshold.
 *
 * Why descriptive tags + materials matter: in production the `tags` column is a
 * flat keyword array (["caneta","metal"]), so the structured marketing tags are
 * almost always empty. Descriptive tags, materials and name tokens are the signals
 * that actually discriminate real catalogue products.
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

/** Stopwords PT-BR para tokenização de nomes (evita falsos positivos de similaridade). */
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
  'pcs',
  'kit',
]);

export function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Tokeniza um nome de produto em termos significativos (sem acento, sem stopword). */
export function tokenizeName(input: string | null | undefined): Set<string> {
  if (!input) return new Set();
  return new Set(
    normalizeText(input)
      .split(/[^a-z0-9]+/)
      .filter((w) => {
        if (w.length > 2) return !STOPWORDS_PT.has(w);
        // Mantém tokens de 2 chars apenas se contiverem dígito (A4, 2L, 5G…)
        if (w.length === 2) return /[0-9]/.test(w);
        return false;
      }),
  );
}

/** Similaridade de Jaccard entre dois conjuntos de tokens (0..1). */
export function nameTokenSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => {
    if (b.has(t)) inter += 1;
  });
  return inter / (a.size + b.size - inter);
}

export function findComplementaryKeywords(name: string): string[] {
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

/** Normaliza uma lista de termos (trim + lowercase + remove vazios). */
function normalizeTermList(list: readonly string[] | undefined | null): string[] {
  if (!Array.isArray(list)) return [];
  return list.map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : '')).filter(Boolean);
}

function sharedTerms(a: string[], b: string[]): string[] {
  if (a.length === 0 || b.length === 0) return [];
  const setB = new Set(b);
  // dedup preservando ordem de `a`
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of a) {
    if (setB.has(t) && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

const DESCRIPTOR_POINTS = 8;
const DESCRIPTOR_MAX = 24;
const MATERIAL_POINTS = 6;
const MATERIAL_MAX = 12;

/**
 * Igualdade de identificadores tolerante a tipo. A bridge externa pode devolver
 * `category_id`/`supplier_id` como número ou string conforme o fornecedor, então
 * comparar com `===` cru perderia matches legítimos (5 !== "5"). Ids vazios/nulos
 * nunca casam.
 */
export function eqId(a: unknown, b: unknown): boolean {
  const blank = (v: unknown) => v === null || v === undefined || v === '';
  if (blank(a) || blank(b)) return false;
  return String(a) === String(b);
}

export function calculateMatchScore(
  source: Product,
  candidate: Product,
  /** Complementos pré-calculados do `source` (otimização — evita recomputar por candidato). */
  precomputedComplements?: string[],
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Same category
  if (eqId(source.category_id, candidate.category_id)) {
    score += 30;
    reasons.push('Mesma categoria');
  }

  // Shared marketing tags
  const tagCategories: (keyof Product['tags'])[] = [
    'publicoAlvo',
    'datasComemorativas',
    'endomarketing',
  ];
  for (const tagCat of tagCategories) {
    const shared = sharedTerms(
      normalizeTermList(source.tags?.[tagCat]),
      normalizeTermList(candidate.tags?.[tagCat]),
    );
    if (shared.length > 0) {
      score += 10 * shared.length;
      reasons.push(`${MATCH_TAG_LABELS[tagCat]}: ${shared.join(', ')}`);
    }
  }

  // Shared nicho/ramo
  const srcNiches = normalizeTermList([
    ...(source.tags?.nicho ?? []),
    ...(source.tags?.ramo ?? []),
  ]);
  const candNiches = normalizeTermList([
    ...(candidate.tags?.nicho ?? []),
    ...(candidate.tags?.ramo ?? []),
  ]);
  const sharedNiches = sharedTerms(srcNiches, candNiches);
  if (sharedNiches.length > 0) {
    score += 15 * sharedNiches.length;
    reasons.push(`Nicho: ${sharedNiches.join(', ')}`);
  }

  // Same supplier
  if (eqId(source.supplier?.id, candidate.supplier?.id)) {
    score += 5;
    reasons.push('Mesmo fornecedor');
  }

  // Shared descriptive tags (flat catalogue keywords — primary real-world signal)
  const sharedDescriptors = sharedTerms(
    normalizeTermList(source.descriptiveTags),
    normalizeTermList(candidate.descriptiveTags),
  );
  if (sharedDescriptors.length > 0) {
    score += Math.min(DESCRIPTOR_POINTS * sharedDescriptors.length, DESCRIPTOR_MAX);
    reasons.push(`Descritor: ${sharedDescriptors.slice(0, 3).join(', ')}`);
  }

  // Shared materials
  const sharedMaterials = sharedTerms(
    normalizeTermList(source.materials),
    normalizeTermList(candidate.materials),
  );
  if (sharedMaterials.length > 0) {
    score += Math.min(MATERIAL_POINTS * sharedMaterials.length, MATERIAL_MAX);
    reasons.push(`Material: ${sharedMaterials.slice(0, 2).join(', ')}`);
  }

  // Complementary name keywords (exclude self-matching)
  const complements = precomputedComplements ?? findComplementaryKeywords(source.name);
  if (complements.length > 0) {
    const candNormalized = normalizeText(candidate.name);
    const sourceNormalized = normalizeText(source.name);
    const matchedKeywords = complements.filter((kw) => {
      const kwNorm = normalizeText(kw);
      // Only count if keyword matches candidate but NOT source (avoid self-match)
      return (
        kwNorm.length > 0 && candNormalized.includes(kwNorm) && !sourceNormalized.includes(kwNorm)
      );
    });
    if (matchedKeywords.length > 0) {
      // dedup
      const unique = [...new Set(matchedKeywords)];
      score += 20 * unique.length;
      reasons.push(`Complementar: ${unique.join(', ')}`);
    }
  }

  return { score, reasons };
}

/** Limiar de similaridade de nome a partir do qual tratamos como "Idêntico". */
export const IDENTICAL_NAME_SIMILARITY = 0.5;

/** Mínimo de tokens em comum exigido para classificar como "Idêntico" (evita
 *  falsos positivos quando ambos os nomes têm poucos termos genéricos). */
export const IDENTICAL_MIN_SHARED_TOKENS = 2;

export function getMatchType(args: {
  hasComplementary: boolean;
  nameSim: number;
  /** Nº de tokens em comum entre os nomes. Default 2 = não bloqueia (uso em testes puros). */
  sharedTokens?: number;
}): MatchResult['matchType'] {
  if (args.hasComplementary) return 'complementary';
  const sharedTokens = args.sharedTokens ?? IDENTICAL_MIN_SHARED_TOKENS;
  if (args.nameSim >= IDENTICAL_NAME_SIMILARITY && sharedTokens >= IDENTICAL_MIN_SHARED_TOKENS) {
    return 'identical';
  }
  return 'similar';
}

/** Filtros para limitar quais produtos correspondentes são retornados pelo hook. */
export interface MatchFilters {
  minScore: number;
  matchTypes: MatchResult['matchType'][];
  /** Filtro por id de categoria (robusto — independe do nome exibido). */
  categoryId?: string;
  /** @deprecated Filtro por nome de categoria. Use `categoryId`. Mantido por compat. */
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

    // Pré-cálculo único por source (otimização — antes era recomputado por candidato).
    const sourceComplements = findComplementaryKeywords(sourceProduct.name);
    const sourceTokens = tokenizeName(sourceProduct.name);

    const results: MatchResult[] = [];

    for (const candidate of allProducts) {
      if (candidate.id === sourceProduct.id) continue;

      // Pre-filters
      if (mergedFilters.onlyInStock && candidate.stockStatus === 'out-of-stock') continue;
      if (mergedFilters.categoryId && !eqId(candidate.category_id, mergedFilters.categoryId))
        continue;
      if (mergedFilters.categoryFilter && candidate.category?.name !== mergedFilters.categoryFilter)
        continue;
      if (mergedFilters.supplierFilter && candidate.supplier?.name !== mergedFilters.supplierFilter)
        continue;

      const { score, reasons } = calculateMatchScore(sourceProduct, candidate, sourceComplements);
      if (score < mergedFilters.minScore) continue;

      const hasComplementary = reasons.some((r) => r.startsWith('Complementar'));
      const candidateTokens = tokenizeName(candidate.name);
      const nameSim = nameTokenSimilarity(sourceTokens, candidateTokens);
      let sharedTokens = 0;
      sourceTokens.forEach((t) => {
        if (candidateTokens.has(t)) sharedTokens += 1;
      });
      const matchType = getMatchType({ hasComplementary, nameSim, sharedTokens });

      if (!mergedFilters.matchTypes.includes(matchType)) continue;

      results.push({ product: candidate, score, reasons, matchType });
    }

    // Ordena por score; desempata por similaridade de nome (mais "igual" primeiro).
    return results.sort((a, b) => b.score - a.score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sourceProduct,
    allProducts,
    mergedFilters.minScore,
    matchTypesKey,
    mergedFilters.categoryId,
    mergedFilters.categoryFilter,
    mergedFilters.supplierFilter,
    mergedFilters.onlyInStock,
  ]);

  return { matches, isProcessing: false };
}
