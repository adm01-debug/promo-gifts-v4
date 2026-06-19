import type Fuse from 'fuse.js';
import type { IFuseOptions } from 'fuse.js';

export interface SearchableProductLike {
  id: string;
  name: string;
  sku?: string | null;
  supplier_reference?: string | null;
  brand?: string | null;
  category_name?: string | null;
  description?: string | null;
}

const DEFAULT_FUSE_OPTIONS = {
  keys: [
    { name: 'sku', weight: 0.35 },
    { name: 'name', weight: 0.3 },
    { name: 'supplier_reference', weight: 0.1 },
    { name: 'brand', weight: 0.08 },
    { name: 'category_name', weight: 0.07 },
    { name: 'description', weight: 0.05 },
  ],
  threshold: 0.4,
  distance: 100,
  includeScore: true,
  minMatchCharLength: 2,
  ignoreLocation: true,
  findAllMatches: true,
  useExtendedSearch: false,
} satisfies IFuseOptions<SearchableProductLike>;

export function normalizeProductSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function createProductFuseOptions<T extends SearchableProductLike>(
  overrides: Partial<IFuseOptions<T>> = {},
): IFuseOptions<T> {
  return {
    ...DEFAULT_FUSE_OPTIONS,
    keys: DEFAULT_FUSE_OPTIONS.keys,
    ...overrides,
  };
}

function getNormalizedValue(value: unknown): string {
  return typeof value === 'string' ? normalizeProductSearch(value) : '';
}

function getBestFieldPosition(product: SearchableProductLike, query: string) {
  const fields = [
    product.name,
    product.sku,
    product.supplier_reference,
    product.brand,
    product.category_name,
    product.description,
  ];

  return fields.reduce((best, field) => {
    const position = getNormalizedValue(field).indexOf(query);
    if (position === -1) return best;
    return Math.min(best, position);
  }, Number.POSITIVE_INFINITY);
}

function sortByRelevancePosition<T extends SearchableProductLike>(items: T[], query: string) {
  return items.sort((a, b) => getBestFieldPosition(a, query) - getBestFieldPosition(b, query));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Classifica produtos por relevância ao termo de busca.
 *
 * ⚠️ REGRA DE NEGÓCIO — NÃO ALTERAR A HIERARQUIA DE PRIORIDADE:
 *   1. SKU / Referência exata (match perfeito)
 *   2. Nome exato
 *   3. Nome começa com o termo  ("Caneta Plástica" para busca "caneta")
 *   4. Palavra exata no nome    ("Porta Caneta" — word boundary)
 *   5. Nome contém o termo
 *   6. Código (SKU/ref) começa com / contém
 *   7. Metadados (marca, categoria, descrição)
 *   8. Fuzzy via Fuse.js (score < fuzzyThreshold)
 *
 * Dentro de cada grupo, itens são sub-ordenados pela posição do match
 * mais à esquerda nos campos do produto (sortByRelevancePosition).
 *
 * Esta ordem é preservada no catálogo quando o sort padrão "Nome A-Z"
 * está ativo (ver useCatalogState.ts → skipSort).
 */
export function rankProductSearchResults<T extends SearchableProductLike>(
  products: T[],
  searchQuery: string,
  fuse?: Fuse<T>,
  options: {
    limit?: number;
    fuzzyThreshold?: number;
  } = {},
): T[] {
  const normalizedQuery = normalizeProductSearch(searchQuery);
  const limit = options.limit;
  const fuzzyThreshold = options.fuzzyThreshold ?? 0.45;

  if (!normalizedQuery || normalizedQuery.length < 2) {
    return typeof limit === 'number' ? products.slice(0, limit) : products;
  }

  const exactCodeMatches = products.filter((product) => {
    const sku = getNormalizedValue(product.sku);
    const supplierReference = getNormalizedValue(product.supplier_reference);
    return sku === normalizedQuery || supplierReference === normalizedQuery;
  });

  if (exactCodeMatches.length > 0) {
    return typeof limit === 'number' ? exactCodeMatches.slice(0, limit) : exactCodeMatches;
  }

  const nameExact: T[] = [];
  const nameStartsWith: T[] = [];
  const nameExactWord: T[] = [];
  const nameContains: T[] = [];
  const codeStartsWith: T[] = [];
  const codeContains: T[] = [];
  const metadataContains: T[] = [];

  const wordBoundary = new RegExp(`\\b${escapeRegExp(normalizedQuery)}\\b`, 'i');

  for (const product of products) {
    const name = getNormalizedValue(product.name);
    const sku = getNormalizedValue(product.sku);
    const supplierReference = getNormalizedValue(product.supplier_reference);
    const brand = getNormalizedValue(product.brand);
    const categoryName = getNormalizedValue(product.category_name);
    const description = getNormalizedValue(product.description);

    if (name === normalizedQuery) {
      nameExact.push(product);
    } else if (name.startsWith(normalizedQuery)) {
      nameStartsWith.push(product);
    } else if (wordBoundary.test(name)) {
      nameExactWord.push(product);
    } else if (name.includes(normalizedQuery)) {
      nameContains.push(product);
    } else if (sku.startsWith(normalizedQuery) || supplierReference.startsWith(normalizedQuery)) {
      codeStartsWith.push(product);
    } else if (sku.includes(normalizedQuery) || supplierReference.includes(normalizedQuery)) {
      codeContains.push(product);
    } else if (
      brand.includes(normalizedQuery) ||
      categoryName.includes(normalizedQuery) ||
      description.includes(normalizedQuery)
    ) {
      metadataContains.push(product);
    }
  }

  const fuzzyItems = fuse
    ? fuse
        .search(searchQuery)
        .filter((result) => (result.score ?? 1) < fuzzyThreshold)
        .map((result) => result.item)
    : [];

  const combined = dedupeById([
    ...sortByRelevancePosition(nameExact, normalizedQuery),
    ...sortByRelevancePosition(nameStartsWith, normalizedQuery),
    ...sortByRelevancePosition(nameExactWord, normalizedQuery),
    ...sortByRelevancePosition(nameContains, normalizedQuery),
    ...sortByRelevancePosition(codeStartsWith, normalizedQuery),
    ...sortByRelevancePosition(codeContains, normalizedQuery),
    ...sortByRelevancePosition(metadataContains, normalizedQuery),
    ...fuzzyItems,
  ]);

  return typeof limit === 'number' ? combined.slice(0, limit) : combined;
}
