/**
 * Testes do useProductMatch — engine RICA: similaridade de nome (tokens/Jaccard),
 * scoring (categoria/tags/nicho/fornecedor/descritor/material/complementar), getMatchType
 * por nameSim, e o hook público (filtros + ordenação com desempate por similaridade).
 *
 * Importa a implementação REAL do módulo (sem cópias inline), protegendo a produção
 * contra regressões.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Product } from '@/types/product-catalog';
import {
  normalizeText,
  tokenizeName,
  nameTokenSimilarity,
  findComplementaryKeywords,
  calculateMatchScore,
  getMatchType,
  useProductMatch,
  eqId,
  IDENTICAL_NAME_SIMILARITY,
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
  it('lowercases text', () => expect(normalizeText('CANETA')).toBe('caneta'));
  it('removes accents', () => {
    expect(normalizeText('Tábua')).toBe('tabua');
    expect(normalizeText('café')).toBe('cafe');
    expect(normalizeText('xícara')).toBe('xicara');
    expect(normalizeText('chapéu')).toBe('chapeu');
    expect(normalizeText('Aço inox')).toBe('aco inox');
  });
  it('handles empty string', () => expect(normalizeText('')).toBe(''));
  it('handles mixed case with accents', () => expect(normalizeText('Ação Rápida')).toBe('acao rapida'));
});

describe('eqId', () => {
  it('coerces type-mixed ids (number vs string)', () => {
    expect(eqId(1, '1')).toBe(true);
    expect(eqId('abc', 'abc')).toBe(true);
    expect(eqId(1, 2)).toBe(false);
  });
  it('treats null/undefined as never equal', () => {
    expect(eqId(null, null)).toBe(false);
    expect(eqId(undefined, undefined)).toBe(false);
    expect(eqId(null, '1')).toBe(false);
  });
});

describe('tokenizeName', () => {
  it('strips stopwords and short tokens', () => {
    const t = tokenizeName('Caneta de Metal em Bambu');
    expect(t.has('caneta')).toBe(true);
    expect(t.has('metal')).toBe(true);
    expect(t.has('bambu')).toBe(true);
    expect(t.has('de')).toBe(false);
    expect(t.has('em')).toBe(false);
  });
  it('keeps 2-char tokens only when they contain a digit', () => {
    const t = tokenizeName('Caderno A5 ml');
    expect(t.has('a5')).toBe(true);
    expect(t.has('ml')).toBe(false);
  });
  it('handles empty/nullish input', () => {
    expect(tokenizeName('').size).toBe(0);
    expect(tokenizeName(null).size).toBe(0);
    expect(tokenizeName(undefined).size).toBe(0);
  });
});

describe('nameTokenSimilarity', () => {
  it('is 1 for identical token sets', () =>
    expect(nameTokenSimilarity(tokenizeName('Caneta Metal'), tokenizeName('Metal Caneta'))).toBe(1));
  it('is 0 for disjoint token sets', () =>
    expect(nameTokenSimilarity(tokenizeName('Caneta Metal'), tokenizeName('Mochila Nylon'))).toBe(0));
  it('is 0 when either set is empty', () =>
    expect(nameTokenSimilarity(tokenizeName(''), tokenizeName('Caneta'))).toBe(0));
  it('detects near-duplicate colour variants as highly similar', () => {
    const a = tokenizeName('Caneta Metal Azul');
    const b = tokenizeName('Caneta Metal Vermelha');
    expect(nameTokenSimilarity(a, b)).toBeGreaterThanOrEqual(IDENTICAL_NAME_SIMILARITY);
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
  it('finds reverse complements for caderno', () =>
    expect(findComplementaryKeywords('Caderno Universitário')).toContain('caneta'));
  it('returns empty array for unmatched product', () =>
    expect(findComplementaryKeywords('Pen Drive USB')).toEqual([]));
  it('handles accent variations correctly', () =>
    expect(findComplementaryKeywords('TABUA DE CORTE')).toContain('faca'));
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

describe('calculateMatchScore — descriptive tags', () => {
  it('scores shared flat descriptive tags (+8 each)', () => {
    const source = makeProduct({ id: '1', name: 'Copo de viagem inox', descriptiveTags: ['copo', 'inox', 'parede dupla'], supplier: { id: 'a', name: 'A' }, category_id: 'c1' });
    const candidate = makeProduct({ id: '2', name: 'Caneca térmica', descriptiveTags: ['copo', 'inox'], supplier: { id: 'b', name: 'B' }, category_id: 'c2' });
    const { score, reasons } = calculateMatchScore(source, candidate);
    expect(score).toBe(16);
    expect(reasons.some((r) => r.startsWith('Descritor'))).toBe(true);
  });
  it('caps descriptive-tag contribution at +24', () => {
    const many = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6'];
    const source = makeProduct({ id: '1', name: 'X', descriptiveTags: many, supplier: { id: 'a', name: 'A' }, category_id: 'c1' });
    const candidate = makeProduct({ id: '2', name: 'Y', descriptiveTags: many, supplier: { id: 'b', name: 'B' }, category_id: 'c2' });
    expect(calculateMatchScore(source, candidate).score).toBe(24);
  });
  it('is case/whitespace-insensitive for descriptive tags', () => {
    const source = makeProduct({ id: '1', name: 'X', descriptiveTags: [' Aço Inox '], supplier: { id: 'a', name: 'A' }, category_id: 'c1' });
    const candidate = makeProduct({ id: '2', name: 'Y', descriptiveTags: ['aço inox'], supplier: { id: 'b', name: 'B' }, category_id: 'c2' });
    expect(calculateMatchScore(source, candidate).score).toBe(8);
  });
});

describe('calculateMatchScore — materials', () => {
  it('scores shared materials (+6 each)', () => {
    const source = makeProduct({ id: '1', name: 'X', materials: ['Aço Inox', 'Bambu'], supplier: { id: 'a', name: 'A' }, category_id: 'c1' });
    const candidate = makeProduct({ id: '2', name: 'Y', materials: ['Aço Inox'], supplier: { id: 'b', name: 'B' }, category_id: 'c2' });
    const { score, reasons } = calculateMatchScore(source, candidate);
    expect(score).toBe(6);
    expect(reasons.some((r) => r.startsWith('Material'))).toBe(true);
  });
  it('does not double-count a term present in both descriptiveTags and materials', () => {
    const source = makeProduct({ id: '1', name: 'X', descriptiveTags: ['metal'], materials: ['Metal'], supplier: { id: 'a', name: 'A' }, category_id: 'c1' });
    const candidate = makeProduct({ id: '2', name: 'Y', descriptiveTags: ['metal'], materials: ['Metal'], supplier: { id: 'b', name: 'B' }, category_id: 'c2' });
    expect(calculateMatchScore(source, candidate).score).toBe(8);
  });
});

describe('calculateMatchScore — complementary keywords', () => {
  it('scores +20 for complementary match: tábua → faca', () => {
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
  it('uses precomputed complements when provided (3-arg)', () => {
    const source = makeProduct({ id: '1', name: 'Caneta', supplier: { id: 'a', name: 'A' }, category_id: 'c1' });
    const candidate = makeProduct({ id: '2', name: 'Caderno', supplier: { id: 'b', name: 'B' }, category_id: 'c2' });
    const complements = findComplementaryKeywords(source.name);
    expect(calculateMatchScore(source, candidate, complements).reasons.some((r) => r.startsWith('Complementar'))).toBe(true);
  });
  it('does NOT false-positive inside a longer word (bone ∉ trombone)', () => {
    const source = makeProduct({ id: '1', name: 'Camiseta Polo', supplier: { id: 'a', name: 'A' }, category_id: 'c1' });
    const candidate = makeProduct({ id: '2', name: 'Trombone Musical', supplier: { id: 'b', name: 'B' }, category_id: 'c2' });
    expect(calculateMatchScore(source, candidate).reasons.some((r) => r.startsWith('Complementar'))).toBe(false);
  });
  it('accepts plural by prefix (canudo → canudos)', () => {
    const source = makeProduct({ id: '1', name: 'Squeeze Fitness', supplier: { id: 'a', name: 'A' }, category_id: 'c1' });
    const candidate = makeProduct({ id: '2', name: 'Canudos Inox', supplier: { id: 'b', name: 'B' }, category_id: 'c2' });
    expect(calculateMatchScore(source, candidate).reasons.some((r) => r.startsWith('Complementar'))).toBe(true);
  });
});

describe('calculateMatchScore — combined & unrelated', () => {
  it('reaches a very high score with category + tags + nicho + supplier + complementary', () => {
    const tags = { publicoAlvo: ['Executivo'], datasComemorativas: ['Natal'], endomarketing: ['Integração'], ramo: ['Tecnologia'], nicho: ['Escritório'] };
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
    expect(getMatchType({ hasComplementary: true, nameSim: 1 })).toBe('complementary');
    expect(getMatchType({ hasComplementary: true, nameSim: 0 })).toBe('complementary');
  });
  it('classifies near-duplicates as identical', () => {
    expect(getMatchType({ hasComplementary: false, nameSim: IDENTICAL_NAME_SIMILARITY })).toBe('identical');
    expect(getMatchType({ hasComplementary: false, nameSim: 0.9 })).toBe('identical');
  });
  it('classifies low name-similarity as similar', () => {
    expect(getMatchType({ hasComplementary: false, nameSim: 0.2 })).toBe('similar');
    expect(getMatchType({ hasComplementary: false, nameSim: 0 })).toBe('similar');
  });
  it('requires (near-)exact name for single-token identical', () => {
    expect(getMatchType({ hasComplementary: false, nameSim: 1, sharedTokens: 1 })).toBe('identical');
    expect(getMatchType({ hasComplementary: false, nameSim: 0.5, sharedTokens: 1 })).toBe('similar');
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
  it('classifies a near-duplicate from another supplier as identical', () => {
    const dup = makeProduct({ id: 'dup', name: 'Caneta Metal Vermelha', category_id: 'cat-1', supplier: { id: 's2', name: 'B' } });
    const { result } = renderHook(() => useProductMatch(source, [dup], { minScore: 1 }));
    expect(result.current.matches.find((m) => m.product.id === 'dup')?.matchType).toBe('identical');
  });
  it('classifies a byte-identical SINGLE-token product as identical', () => {
    const s = makeProduct({ id: 's', name: 'Squeeze', category_id: 'cat-1', supplier: { id: 'a', name: 'A' } });
    const dup = makeProduct({ id: 'd', name: 'Squeeze', category_id: 'cat-1', supplier: { id: 'b', name: 'B' } });
    const { result } = renderHook(() => useProductMatch(s, [dup], { minScore: 1 }));
    expect(result.current.matches[0]?.matchType).toBe('identical');
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
  it('results carry nameSim and ties break by name similarity', () => {
    const closer = makeProduct({ id: 'closer', name: 'Caneta Metal Verde', category_id: 'cat-1', supplier: { id: 'b', name: 'B' } });
    const farther = makeProduct({ id: 'farther', name: 'Mochila Nylon', category_id: 'cat-1', supplier: { id: 'b', name: 'B' } });
    const { result } = renderHook(() => useProductMatch(source, [farther, closer], { minScore: 1 }));
    expect(typeof result.current.matches[0]?.nameSim).toBe('number');
    expect(result.current.matches[0]?.product.id).toBe('closer');
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
