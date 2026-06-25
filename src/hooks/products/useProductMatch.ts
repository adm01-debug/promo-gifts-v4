/**
 * useProductMatch — Encontra produtos correspondentes por categoria, tags, nicho,
 * tags descritivas, materiais, relações complementares e SIMILARIDADE DE NOME.
 *
 * Pontuação (aditiva):
 * - Mesma categoria: +30
 * - Tag compartilhada (público/datas/endomarketing): +10 cada
 * - Nicho/ramo compartilhado: +15 cada
 * - Mesmo fornecedor: +5
 * - Tag descritiva compartilhada: +8 cada (teto +24 p/ evitar inundação de tags genéricas)
 * - Material compartilhado: +6 cada (termos já contados como descritor não são duplicados)
 * - Keyword complementar no nome (fronteira de palavra, tolerante a plural): +20 cada
 *
 * A similaridade de nome (Jaccard de tokens) é calculada à parte e usada para CLASSIFICAR
 * o tipo do match (identical vs similar) e como critério de desempate — NÃO soma ao score.
 */
import { useMemo } from 'react';
import type { Product } from '@/types/product-catalog';

/** Produto correspondente com pontuação de relevância, motivos e similaridade de nome. */
export interface MatchResult {
  product: Product;
  score: number;
  reasons: string[];
  matchType: 'complementary' | 'identical' | 'similar';
  /** Similaridade de nome (Jaccard de tokens) fonte↔candidato — usada na classificação e no desempate. */
  nameSim: number;
}

/**
 * Limiar de similaridade de nome (Jaccard) a partir do qual dois produtos com 2+ tokens
 * compartilhados são "idênticos" (ex.: variantes de cor: "Caneta Metal Azul" vs
 * "Caneta Metal Vermelha" = 0.5).
 */
export const IDENTICAL_NAME_SIMILARITY = 0.5;

/** Para matches de UM único token, exige nome (quase) exato para classificar como idêntico. */
const SINGLE_TOKEN_IDENTICAL_SIMILARITY = 1;

// Pares de keywords de produtos complementares (Português)
const COMPLEMENTARY_PAIRS: [string[], string[]][] = [
  [['tábua', 'tabua'], ['faca', 'garfo', 'espeto', 'pegador']],
  [['caneta'], ['caderno', 'agenda', 'bloco', 'estojo']],
  [['garrafa', 'squeeze', 'copo'], ['canudo', 'tampa', 'abridor']],
  [['mochila', 'bolsa', 'mala'], ['necessaire', 'estojo', 'porta']],
  [['camiseta', 'camisa'], ['boné', 'bone', 'chapéu']],
  [['mouse', 'teclado'], ['mousepad', 'hub', 'suporte']],
  [['carregador', 'powerbank'], ['cabo', 'adaptador']],
  [['vinho', 'cerveja'], ['abridor', 'saca-rolha', 'taça', 'copo']],
  [['churrasco'], ['avental', 'tábua', 'tabua', 'faca', 'espeto', 'pegador', 'grelha']],
  [['café', 'cafe'], ['xícara', 'caneca', 'copo', 'coador']],
  [['toalha'], ['roupão', 'chinelo', 'necessaire']],
  [['cadeira'], ['almofada', 'encosto', 'apoio']],
];

// Stopwords PT/EN que não contribuem para a tokenização de nome.
const NAME_STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'pra', 'com', 'sem', 'sob',
  'por', 'a', 'o', 'as', 'os', 'no', 'na', 'nos', 'nas', 'ao', 'aos', 'um', 'uma',
  'the', 'of', 'in', 'for', 'and', 'to', 'with',
]);

export function normalizeText(text: string): string {
  return (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Igualdade robusta de ids (tolera number vs string; null/undefined nunca são iguais). */
export function eqId(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

/**
 * Tokeniza um nome de produto: normaliza, remove stopwords e tokens curtos.
 * Mantém tokens de 2 chars apenas quando contêm dígito (ex.: "a5"); descarta "ml".
 */
export function tokenizeName(name: string | null | undefined): Set<string> {
  const tokens = new Set<string>();
  if (!name) return tokens;
  for (const raw of normalizeText(name).split(/[^a-z0-9]+/)) {
    if (!raw || NAME_STOPWORDS.has(raw)) continue;
    const hasDigit = /[0-9]/.test(raw);
    if (raw.length >= 3 || (raw.length === 2 && hasDigit)) tokens.add(raw);
  }
  return tokens;
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let n = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const t of small) if (large.has(t)) n++;
  return n;
}

/** Similaridade de Jaccard entre dois conjuntos de tokens (0 se algum estiver vazio). */
export function nameTokenSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const inter = intersectionSize(a, b);
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Casa uma keyword como palavra inteira (tolerante a plural -s/-es) dentro de um texto normalizado. */
function wordMatch(keywordNormalized: string, haystackNormalized: string): boolean {
  if (!keywordNormalized) return false;
  return new RegExp(`\\b${escapeRegExp(keywordNormalized)}(s|es)?\\b`).test(haystackNormalized);
}

/**
 * Retorna keywords complementares (já normalizadas, sem duplicatas) para um nome.
 * Bidirecional: se o nome contém termo do grupo A, retorna o grupo B, e vice-versa.
 */
export function findComplementaryKeywords(name: string): string[] {
  const normalized = normalizeText(name);
  const complements = new Set<string>();
  for (const [groupA, groupB] of COMPLEMENTARY_PAIRS) {
    if (groupA.some((kw) => wordMatch(normalizeText(kw), normalized)))
      groupB.forEach((kw) => complements.add(normalizeText(kw)));
    if (groupB.some((kw) => wordMatch(normalizeText(kw), normalized)))
      groupA.forEach((kw) => complements.add(normalizeText(kw)));
  }
  return [...complements];
}

const MATCH_TAG_LABELS: Record<string, string> = {
  publicoAlvo: 'Público-alvo',
  datasComemorativas: 'Data comemorativa',
  endomarketing: 'Endomarketing',
} as const;

const CATEGORY_POINTS = 30;
const TAG_POINTS = 10;
const NICHE_POINTS = 15;
const SUPPLIER_POINTS = 5;
const DESCRIPTIVE_TAG_POINTS = 8;
const DESCRIPTIVE_TAG_CAP = 24;
const MATERIAL_POINTS = 6;
const COMPLEMENTARY_POINTS = 20;

function normalizedList(values: readonly string[] | null | undefined): string[] {
  // Normaliza, remove vazios E DEDUPLICA (preservando ordem). O lado candidato vira Set,
  // mas o lado source é percorrido como array em .filter() — sem dedup aqui, valores
  // repetidos no MESMO produto (dados sujos de fornecedor) inflavam o score: tag 'Jovem'
  // duplicada contava +20; nicho/ramo com o mesmo termo somava 2×; material repetido
  // inflava SEM teto. Deduplicar normaliza tudo a "1 conceito = 1 contribuição".
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values ?? []) {
    const n = normalizeText(String(v)).trim();
    if (n.length > 0 && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/**
 * Pontua a relevância de `candidate` em relação a `source`.
 * @param precomputedComplements complementos já calculados de source.name (otimização do hook).
 */
export function calculateMatchScore(
  source: Product,
  candidate: Product,
  precomputedComplements?: string[],
): { score: number; reasons: string[]; hasComplementary: boolean } {
  let score = 0;
  const reasons: string[] = [];
  let hasComplementary = false;

  // Mesma categoria
  if (source.category_id && candidate.category_id && source.category_id === candidate.category_id) {
    score += CATEGORY_POINTS;
    reasons.push('Mesma categoria');
  }

  // Tags compartilhadas
  const tagCategories: (keyof Product['tags'])[] = ['publicoAlvo', 'datasComemorativas', 'endomarketing'];
  for (const tagCat of tagCategories) {
    const srcTags = normalizedList(source.tags?.[tagCat]);
    const candTags = new Set(normalizedList(candidate.tags?.[tagCat]));
    const shared = srcTags.filter((t) => candTags.has(t));
    if (shared.length > 0) {
      score += TAG_POINTS * shared.length;
      reasons.push(`${MATCH_TAG_LABELS[tagCat]}: ${shared.join(', ')}`);
    }
  }

  // Nicho/ramo compartilhado (pool único)
  const srcNiches = normalizedList([...(source.tags?.nicho ?? []), ...(source.tags?.ramo ?? [])]);
  const candNiches = new Set(normalizedList([...(candidate.tags?.nicho ?? []), ...(candidate.tags?.ramo ?? [])]));
  const sharedNiches = srcNiches.filter((n) => candNiches.has(n));
  if (sharedNiches.length > 0) {
    score += NICHE_POINTS * sharedNiches.length;
    reasons.push(`Nicho: ${sharedNiches.join(', ')}`);
  }

  // Mesmo fornecedor
  if (source.supplier?.id && candidate.supplier?.id && source.supplier.id === candidate.supplier.id) {
    score += SUPPLIER_POINTS;
    reasons.push('Mesmo fornecedor');
  }

  // Tags descritivas compartilhadas (com teto)
  const srcDesc = normalizedList(source.descriptiveTags);
  const candDesc = new Set(normalizedList(candidate.descriptiveTags));
  const sharedDesc = srcDesc.filter((t) => candDesc.has(t));
  const sharedDescSet = new Set(sharedDesc);
  if (sharedDesc.length > 0) {
    score += Math.min(sharedDesc.length * DESCRIPTIVE_TAG_POINTS, DESCRIPTIVE_TAG_CAP);
    reasons.push(`Descritor: ${sharedDesc.join(', ')}`);
  }

  // Materiais compartilhados (excluindo termos já contados como descritor)
  const srcMat = normalizedList(source.materials);
  const candMat = new Set(normalizedList(candidate.materials));
  const sharedMat = srcMat.filter((m) => candMat.has(m) && !sharedDescSet.has(m));
  if (sharedMat.length > 0) {
    score += MATERIAL_POINTS * sharedMat.length;
    reasons.push(`Material: ${sharedMat.join(', ')}`);
  }

  // Keywords complementares no nome (fronteira de palavra, tolerante a plural, sem self-match)
  const complements = precomputedComplements ?? findComplementaryKeywords(source.name ?? '');
  if (complements.length > 0) {
    const candNorm = normalizeText(candidate.name ?? '');
    const srcNorm = normalizeText(source.name ?? '');
    const matched = [...new Set(complements.map((c) => normalizeText(c)))].filter(
      (kw) => kw && wordMatch(kw, candNorm) && !wordMatch(kw, srcNorm),
    );
    if (matched.length > 0) {
      score += COMPLEMENTARY_POINTS * matched.length;
      reasons.push(`Complementar: ${matched.join(', ')}`);
      hasComplementary = true;
    }
  }

  return { score, reasons, hasComplementary };
}

/** Classifica o tipo do match a partir de complementaridade + similaridade de nome. */
export function getMatchType(params: {
  hasComplementary: boolean;
  nameSim: number;
  sharedTokens?: number;
}): MatchResult['matchType'] {
  const { hasComplementary, nameSim, sharedTokens } = params;
  if (hasComplementary) return 'complementary';
  // Matches de um único token só são "idênticos" se o nome for (quase) exato.
  if (sharedTokens != null && sharedTokens <= 1) {
    return nameSim >= SINGLE_TOKEN_IDENTICAL_SIMILARITY ? 'identical' : 'similar';
  }
  return nameSim >= IDENTICAL_NAME_SIMILARITY ? 'identical' : 'similar';
}

/** Filtros para limitar quais produtos correspondentes são retornados pelo hook. */
export interface MatchFilters {
  minScore: number;
  matchTypes: MatchResult['matchType'][];
  categoryFilter?: string;
  /** Filtro por category_id (mais robusto que categoryFilter quando o nome não está disponível). */
  categoryId?: string;
  supplierFilter?: string;
  onlyInStock: boolean;
}

const DEFAULT_FILTERS: MatchFilters = {
  minScore: 10,
  matchTypes: ['identical', 'similar', 'complementary'],
  onlyInStock: false,
};

/** Retorna produtos similares/complementares ordenados por pontuação (desempate por similaridade de nome). */
export function useProductMatch(
  sourceProduct: Product | null,
  allProducts: Product[],
  filters: Partial<MatchFilters> = {},
): { matches: MatchResult[]; isProcessing: boolean } {
  const mergedFilters: MatchFilters = { ...DEFAULT_FILTERS, ...filters };
  const matchTypesKey = (mergedFilters.matchTypes || []).join(',');

  const matches = useMemo(() => {
    if (!sourceProduct || allProducts.length === 0) return [];

    const sourceComplements = findComplementaryKeywords(sourceProduct.name ?? '');
    const sourceTokens = tokenizeName(sourceProduct.name);
    const results: MatchResult[] = [];

    for (const candidate of allProducts) {
      if (eqId(candidate.id, sourceProduct.id)) continue;

      // Pré-filtros
      if (mergedFilters.onlyInStock && candidate.stockStatus === 'out-of-stock') continue;
      if (mergedFilters.categoryId && candidate.category_id !== mergedFilters.categoryId) continue;
      if (mergedFilters.categoryFilter && candidate.category?.name !== mergedFilters.categoryFilter) continue;
      if (mergedFilters.supplierFilter && candidate.supplier?.name !== mergedFilters.supplierFilter) continue;

      const { score, reasons, hasComplementary } = calculateMatchScore(sourceProduct, candidate, sourceComplements);
      if (score < mergedFilters.minScore) continue;

      const candTokens = tokenizeName(candidate.name);
      const nameSim = nameTokenSimilarity(sourceTokens, candTokens);
      const sharedTokens = intersectionSize(sourceTokens, candTokens);
      const matchType = getMatchType({ hasComplementary, nameSim, sharedTokens });

      if (!mergedFilters.matchTypes.includes(matchType)) continue;

      results.push({ product: candidate, score, reasons, matchType, nameSim });
    }

    // Ordena por score desc; desempate por similaridade de nome desc.
    return results.sort((a, b) => b.score - a.score || b.nameSim - a.nameSim);
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
