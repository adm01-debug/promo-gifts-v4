/**
 * Tests for useProductMatch — validates the ENGINE THAT ACTUALLY SHIPS:
 * scoring (category/tags/nicho/supplier/complementary), getMatchType thresholds,
 * complementary keyword pairs, and the public hook (filters + descending sort).
 *
 * GAP FLAGGED (2026-06-25): earlier revisions targeted a richer, never-implemented
 * engine — name-token similarity (tokenizeName/nameTokenSimilarity/IDENTICAL_NAME_SIMILARITY),
 * descriptiveTags/materials scoring, nameSim-based matchType + tie-breaking, 3-arg
 * calculateMatchScore. Those symbols NEVER existed in the module (git-proven via `git log -S`),
 * so the suite was red-on-arrival. This rewrite tests the real implementation. Whether to BUILD
 * the richer engine is a product decision (see PR description).
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Product } from '@/types/product-catalog';
import {
  normalizeText,
  findComplementaryKeywords,
  calculateMatchScore,
  getMatchType,
  useProductMatch,
} from '@/hooks/products/useProductMatch';

const emptyTags = () => ({
  publicoAlvo: [] as string[],
  datasComemorativas: [] as string[],
  endomarketing: [] as string[],
  ramo: [] as string[],
  nicho: [] as string[],
});

function makeProduct(overrides: Partial<Product> & { id: string; name: string }): Product {
  return {
    sku: 'SKU-' + overrides.id,
    price: 10,
    shortDescription: '',
    images: [],
    stock: 100,
    colors: [],
    materials: [],
    minQuantity: 1,
    stockStatus: 'in-stock',
    featured: false,
    newArrival: false,
    onSale: false,
    isKit: false,
    category: { id: '1', name: 'Geral' },
    supplier: { id: 'sup-1', name: 'Fornecedor A' },
    tags: emptyTags(),
    ...overrides,
  } as Product;
}

describe('normalizeText', () => {
  it('lowercases text', () => {
    expect(normalizeText('CANETA')).toBe('caneta');
  });
  it('removes accents', () => {
    expect(normalizeText('Tábua')).toBe('tabua');
    expect(normalizeText('café')).toBe('cafe');
    expect(normalizeText('xícara')).toBe('xicara');
    expect(normalizeText('chapéu')).toBe('chapeu');
    expect(normalizeText('Aço inox')).toBe('aco inox');
  });
  it('handles empty string', () => {
    expect(normalizeText('')).toBe('');
  });
  it('handles mixed case with accents', () => {
    expect(normalizeText('Ação Rápida')).toBe('acao rapida');
  });
});

describe('findComplementaryKeywords', () => {
  it('finds complements for "Tábua de Churrasco"', () => {
    const r = findComplementaryKeywords('Tábua de Churrasco');
    expect(r).toContain('faca');
    expect(r).toContain('garfo');
    expect(r).toContain('espeto');
    expect(r).toContain('avental');
    expect(r).toContain('grelha');
  });
  it('finds reverse complements for caderno', () => {
    expect(findComplementaryKeywords('Caderno Universitário')).toContain('caneta');
  });
  it('returns empty array for unmatched product', () => {
    expect(findComplementaryKeywords('Pen Drive USB')).toEqual([]);
  });
  it('handles accent variations correctly', () => {
    expect(findComplementaryKeywords('TABUA DE CORTE')).toContain('faca');
  });
});

describe('calculateMatchScore — category', () => {
  it('scores +30 for same category_id', () => {
    const source = makeProduct({ id: '1', name: 'A', category_id: 'cat-1' });
    const candidate = makeProduct({ id: '2', name: 'B', category_id: 'cat-1', supplier: { id: 'sup-2', name: 'X' } });
    const { score, reasons } = calculateMatchScore(source, candidate);
    expect(score).toBe(30);
    expect(reasons).toContain('Mesma categoria');
  });
  it('does not score when category_id is null/undefined', () => {
    const source = makeProduct({ id: '1', name: 'A', category_id: null });
    const candidate = makeProduct({ id: '2', name: 'B', category_id: null, supplier: { id: 'sup-2', name: 'X' } });
    expect(calculateMatchScore(source, candidate).reasons).not.toContain('Mesma categoria');
  });
});

describe('calculateMatchScore — tags', () => {
  it('scores +10 per shared publicoAlvo tag', () => {
    const source = makeProduct({ id: '1', name: 'A', tags: { ...emptyTags(), publicoAlvo: ['Executivo', 'Premium'] }, supplier: { id: 'sup-x', name: 'X' } });
    const candidate = makeProduct({ id: '2', name: 'B', tags: { ...emptyTags(), publicoAlvo: ['Executivo'] }, supplier: { id: 'sup-y', name: 'Y' }, category_id: 'other' });
    expect(calculateMatchScore(source, candidate).score).toBe(10);
  });
  it('normalizes case and whitespace when matching tags', () => {
    const source = makeProduct({ id: '1', name: 'A', tags: { ...emptyTags(), publicoAlvo: ['  Executivo  '] } });
    const candidate = makeProduct({ id: '2', name: 'B', tags: { ...emptyTags(), publicoAlvo: ['executivo'] }, supplier: { id: 'y', name: 'Y' }, category_id: 'c2' });
    expect(calculateMatchScore(source, candidate).reasons.some((r) => r.includes('executivo'))).toBe(true);
  });
  it('handles undefined tags without throwing', () => {
    const source = makeProduct({ id: '1', name: 'A' });
    (source as unknown as { tags: undefined }).tags = undefined;
    const candidate = makeProduct({ id: '2', name: 'B', supplier: { id: 'y', name: 'Y' }, category_id: 'c2' });
    expect(calculateMatchScore(source, candidate).score).toBeGreaterThanOrEqual(0);
  });
});

describe('calculateMatchScore — nicho/ramo', () => {
  it('scores +15 per shared nicho', () => {
    const source = makeProduct({ id: '1', name: 'A', tags: { ...emptyTags(), nicho: ['Escritório', 'Tecnologia'] }, supplier: { id: 'sup-x', name: 'X' }, category_id: 'other' });
    const candidate = makeProduct({ id: '2', name: 'B', tags: { ...emptyTags(), nicho: ['Escritório'] }, supplier: { id: 'sup-y', name: 'Y' }, category_id: 'other2' });
    expect(calculateMatchScore(source, candidate).score).toBe(15);
  });
  it('treats ramo and nicho as one shared pool', () => {
    const source = makeProduct({ id: '1', name: 'A', tags: { ...emptyTags(), ramo: ['Saúde'] }, supplier: { id: 'x', name: 'X' }, category_id: 'a' });
    const candidate = makeProduct({ id: '2', name: 'B', tags: { ...emptyTags(), nicho: ['Saúde'] }, supplier: { id: 'y', name: 'Y' }, category_id: 'b' });
    expect(calculateMatchScore(source, candidate).score).toBe(15);
  });
});

describe('calculateMatchScore — supplier', () => {
  it('scores +5 for same supplier only', () => {
    const source = makeProduct({ id: '1', name: 'Item X', supplier: { id: 'sup-1', name: 'X' }, category_id: 'c1' });
    const candidate = makeProduct({ id: '2', name: 'Item Y', supplier: { id: 'sup-1', name: 'X' }, category_id: 'c2' });
    const { score, reasons } = calculateMatchScore(source, candidate);
    expect(reasons).toContain('Mesmo fornecedor');
    expect(score).toBe(5);
  });
});

describe('calculateMatchScore — complementary keywords', () => {
  it('scores complementary match: tábua → faca', () => {
    const source = makeProduct({ id: '1', name: 'Tábua de Churrasco', supplier: { id: 'x', name: 'X' }, category_id: 'c1' });
    const candidate = makeProduct({ id: '2', name: 'Faca para Churrasco', supplier: { id: 'y', name: 'Y' }, category_id: 'c2' });
    const { score, reasons } = calculateMatchScore(source, candidate);
    expect(reasons.some((r) => r.startsWith('Complementar'))).toBe(true);
    expect(score).toBeGreaterThanOrEqual(20);
  });
  it('does not self-match keywords present in the source name', () => {
    const source = makeProduct({ id: '1', name: 'Copo Térmico 500ml', supplier: { id: 'a', name: 'A' }, category_id: 'c1' });
    const candidate = makeProduct({ id: '2', name: 'Copo de Vidro', supplier: { id: 'b', name: 'B' }, category_id: 'c2' });
    const { reasons } = calculateMatchScore(source, candidate);
    expect(reasons.some((r) => r.startsWith('Complementar') && r.toLowerCase().includes('copo'))).toBe(false);
  });
  it('matches plural by substring (squeeze → canudos)', () => {
    const source = makeProduct({ id: '1', name: 'Squeeze Fitness', supplier: { id: 'a', name: 'A' }, category_id: 'c1' });
    const candidate = makeProduct({ id: '2', name: 'Canudos Inox', supplier: { id: 'b', name: 'B' }, category_id: 'c2' });
    expect(calculateMatchScore(source, candidate).reasons.some((r) => r.startsWith('Complementar'))).toBe(true);
  });
});

describe('calculateMatchScore — combined & unrelated', () => {
  it('reaches a high score with category + tags + nicho + supplier + complementary', () => {
    const tags = {
      publicoAlvo: ['Executivo'],
      datasComemorativas: ['Natal'],
      endomarketing: ['Integração'],
      ramo: ['Tecnologia'],
      nicho: ['Escritório'],
    };
    const source = makeProduct({ id: '1', name: 'Caneta Executiva', category_id: 'cat-1', supplier: { id: 'sup-1', name: 'A' }, tags });
    const candidate = makeProduct({ id: '2', name: 'Caderno Executivo', category_id: 'cat-1', supplier: { id: 'sup-1', name: 'A' }, tags });
    expect(calculateMatchScore(source, candidate).score).toBeGreaterThanOrEqual(100);
  });
  it('returns 0 for completely unrelated products', () => {
    const source = makeProduct({ id: '1', name: 'Pen Drive', category_id: 'c1', supplier: { id: 's1', name: 'A' } });
    const candidate = makeProduct({ id: '2', name: 'Crachá', category_id: 'c2', supplier: { id: 's2', name: 'B' } });
    expect(calculateMatchScore(source, candidate).score).toBe(0);
  });
});

describe('getMatchType', () => {
  it('complementary always wins', () => {
    expect(getMatchType(100, true, true)).toBe('complementary');
    expect(getMatchType(0, false, true)).toBe('complementary');
  });
  it('identical when same category and score >= 40', () => {
    expect(getMatchType(40, true, false)).toBe('identical');
    expect(getMatchType(80, true, false)).toBe('identical');
  });
  it('similar when same category but score < 40', () => {
    expect(getMatchType(30, true, false)).toBe('similar');
  });
  it('similar when high score but different category', () => {
    expect(getMatchType(80, false, false)).toBe('similar');
  });
});

describe('useProductMatch (hook)', () => {
  const source = makeProduct({ id: 'src', name: 'Caneta Metal Azul', category_id: 'cat-1', supplier: { id: 's1', name: 'A' } });

  it('returns empty when no source product', () => {
    const { result } = renderHook(() => useProductMatch(null, [source], {}));
    expect(result.current.matches).toEqual([]);
  });
  it('excludes the source product itself', () => {
    const { result } = renderHook(() => useProductMatch(source, [source], { minScore: 0 }));
    expect(result.current.matches.find((m) => m.product.id === 'src')).toBeUndefined();
  });
  it('classifies a same-category high-score candidate as identical', () => {
    const tags = { ...emptyTags(), nicho: ['Escritório'] };
    const src2 = makeProduct({ id: 'src2', name: 'Caneta', category_id: 'cat-1', supplier: { id: 's1', name: 'A' }, tags });
    const dup = makeProduct({ id: 'dup', name: 'Lapiseira', category_id: 'cat-1', supplier: { id: 's1', name: 'A' }, tags });
    const { result } = renderHook(() => useProductMatch(src2, [dup], { minScore: 1 }));
    expect(result.current.matches.find((m) => m.product.id === 'dup')?.matchType).toBe('identical');
  });
  it('filters by categoryId (id-based, not display name)', () => {
    const inCat = makeProduct({ id: 'a', name: 'Caneta Plástica', category_id: 'cat-1', supplier: { id: 's2', name: 'B' } });
    const outCat = makeProduct({ id: 'b', name: 'Caneta Luxo', category_id: 'cat-9', supplier: { id: 's2', name: 'B' } });
    const { result } = renderHook(() => useProductMatch(source, [inCat, outCat], { minScore: 1, categoryId: 'cat-1' }));
    const ids = result.current.matches.map((m) => m.product.id);
    expect(ids).toContain('a');
    expect(ids).not.toContain('b');
  });
  it('respects onlyInStock filter', () => {
    const oos = makeProduct({ id: 'oos', name: 'Caneta Metal Preta', category_id: 'cat-1', supplier: { id: 's2', name: 'B' }, stockStatus: 'out-of-stock' });
    const { result } = renderHook(() => useProductMatch(source, [oos], { minScore: 1, onlyInStock: true }));
    expect(result.current.matches).toEqual([]);
  });
  it('sorts matches by descending score', () => {
    const weak = makeProduct({ id: 'weak', name: 'Item Qualquer', category_id: 'cat-9', supplier: { id: 's1', name: 'A' } });
    const strong = makeProduct({ id: 'strong', name: 'Caneta Metal Preta', category_id: 'cat-1', supplier: { id: 's1', name: 'A' } });
    const { result } = renderHook(() => useProductMatch(source, [weak, strong], { minScore: 1 }));
    const scores = result.current.matches.map((m) => m.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(result.current.matches[0].product.id).toBe('strong');
  });
  it('respects matchTypes filter (complementary only)', () => {
    const compl = makeProduct({ id: 'compl', name: 'Caderno Pautado', category_id: 'cat-9', supplier: { id: 's9', name: 'Z' } });
    const sameCat = makeProduct({ id: 'samecat', name: 'Mochila', category_id: 'cat-1', supplier: { id: 's9', name: 'Z' } });
    const { result } = renderHook(() =>
      useProductMatch(source, [compl, sameCat], { minScore: 1, matchTypes: ['complementary'] }),
    );
    const ids = result.current.matches.map((m) => m.product.id);
    expect(ids).toContain('compl');
    expect(ids).not.toContain('samecat');
  });
  it('handles a large candidate pool without error', () => {
    const candidates = Array.from({ length: 1000 }, (_, i) =>
      makeProduct({
        id: `p-${i}`,
        name: i % 5 === 0 ? 'Caneta Metal Edição' : `Produto ${i}`,
        category_id: i % 3 === 0 ? 'cat-1' : `cat-${i}`,
        supplier: { id: `s-${i % 4}`, name: `Sup ${i % 4}` },
      }),
    );
    const { result } = renderHook(() => useProductMatch(source, candidates, { minScore: 1 }));
    expect(result.current.matches.length).toBeGreaterThan(0);
    expect(result.current.matches.length).toBeLessThanOrEqual(1000);
  });
});
