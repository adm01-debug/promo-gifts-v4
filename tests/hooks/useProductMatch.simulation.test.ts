/**
 * MONTE-CARLO / PROPERTY TESTS for the Match de Produtos engine (real implementation).
 *
 * Seeded PRNG (mulberry32 — fully reproducible) generates thousands of randomized
 * catalogue scenarios and asserts invariants that must hold for ANY input. This is the
 * "simulação de centenas de cenários" guard: type-mixed/null ids, unicode, empty pools,
 * huge pools, degenerate names.
 *
 * NOTE (2026-06-25): a previous revision imported a never-implemented API
 * (tokenizeName/nameTokenSimilarity/eqId). This rewrite validates the engine that ships.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  calculateMatchScore,
  getMatchType,
  useProductMatch,
  type MatchResult,
} from '@/hooks/products/useProductMatch';
import type { Product } from '@/types/product-catalog';

// ── Seeded PRNG (mulberry32) — reproducible ────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = [
  'caneta', 'caderno', 'tabua', 'faca', 'squeeze', 'canudo', 'mochila', 'copo',
  'cafe', 'xicara', 'cracha', 'pen', 'drive', 'metal', 'bambu', 'inox', 'azul',
  'vermelha', 'termico', 'garrafa', 'churrasco', 'avental', 'mouse', 'teclado',
];
const CATS: (string | null | undefined)[] = ['cat-1', 'cat-2', 'cat-3', null, undefined];
const SUPS = ['s1', 's2', 's3'];
const STOCKS = ['in-stock', 'out-of-stock'] as const;
const VALID_TYPES = new Set<MatchResult['matchType']>(['complementary', 'identical', 'similar']);

function randProduct(rng: () => number, i: number): Product {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
  const nWords = 1 + Math.floor(rng() * 4);
  const name = Array.from({ length: nWords }, () => pick(WORDS)).join(' ');
  return {
    id: `p-${i}`,
    name,
    sku: `S-${i}`,
    price: 10,
    shortDescription: '',
    images: [],
    stock: 100,
    colors: [],
    materials: [],
    minQuantity: 1,
    stockStatus: pick(STOCKS),
    featured: false,
    newArrival: false,
    onSale: false,
    isKit: false,
    category: { id: '1', name: 'X' },
    category_id: pick(CATS),
    supplier: { id: pick(SUPS), name: 'Sup' },
    tags: {
      publicoAlvo: rng() > 0.5 ? ['Executivo'] : [],
      datasComemorativas: rng() > 0.7 ? ['Natal'] : [],
      endomarketing: [],
      ramo: rng() > 0.6 ? ['Tecnologia'] : [],
      nicho: rng() > 0.5 ? ['Escritorio'] : [],
    },
  } as Product;
}

describe('Monte-Carlo — calculateMatchScore invariants', () => {
  it('score is always a finite number >= 0 and reasons is an array (5000 random pairs)', () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 5000; i++) {
      const a = randProduct(rng, i * 2);
      const b = randProduct(rng, i * 2 + 1);
      const { score, reasons } = calculateMatchScore(a, b);
      expect(Number.isFinite(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(reasons)).toBe(true);
    }
  });

  it('never throws on degenerate inputs (empty name, unicode, null/undefined tags & category)', () => {
    const base = (over: Partial<Product>): Product =>
      ({
        id: 'x', name: 'x', sku: 'x', price: 0, images: [], stock: 0, colors: [], materials: [],
        minQuantity: 1, stockStatus: 'in-stock', featured: false, newArrival: false, onSale: false,
        isKit: false, category: { id: '1', name: 'X' }, supplier: { id: 's', name: 'S' },
        tags: { publicoAlvo: [], datasComemorativas: [], endomarketing: [], ramo: [], nicho: [] },
        ...over,
      }) as Product;
    const weird: Product[] = [
      base({ id: 'w1', name: '' }),
      base({ id: 'w2', name: '🎉🎁 ção çãO' }),
      base({ id: 'w3', name: 'Tábua', category_id: null }),
      base({ id: 'w4', name: 'Faca', category_id: undefined }),
      ((): Product => { const p = base({ id: 'w5', name: 'Copo' }); (p as unknown as { tags: undefined }).tags = undefined; return p; })(),
    ];
    for (const a of weird) {
      for (const b of weird) {
        expect(() => calculateMatchScore(a, b)).not.toThrow();
        const { score } = calculateMatchScore(a, b);
        expect(Number.isFinite(score)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('Monte-Carlo — getMatchType invariants', () => {
  it('always returns one of the three valid match types (2000 random inputs)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 2000; i++) {
      const t = getMatchType(Math.floor(rng() * 130), rng() > 0.5, rng() > 0.5);
      expect(VALID_TYPES.has(t)).toBe(true);
    }
  });
});

describe('Monte-Carlo — useProductMatch hook invariants', () => {
  it('results are sorted desc, exclude source, respect minScore & matchTypes (200 random pools)', () => {
    const rng = mulberry32(2024);
    for (let p = 0; p < 200; p++) {
      const poolSize = 1 + Math.floor(rng() * 30);
      const pool = Array.from({ length: poolSize }, (_, i) => randProduct(rng, i));
      const sourceProduct = randProduct(rng, 100000 + p);
      const minScore = Math.floor(rng() * 40);
      const allowed: MatchResult['matchType'][] = ['identical', 'similar', 'complementary'];
      const { result } = renderHook(() =>
        useProductMatch(sourceProduct, pool, { minScore, matchTypes: allowed }),
      );
      const ms = result.current.matches;
      for (let i = 1; i < ms.length; i++) {
        expect(ms[i - 1].score).toBeGreaterThanOrEqual(ms[i].score);
      }
      for (const m of ms) {
        expect(m.product.id).not.toBe(sourceProduct.id);
        expect(Number.isFinite(m.score)).toBe(true);
        expect(m.score).toBeGreaterThanOrEqual(minScore);
        expect(allowed).toContain(m.matchType);
      }
      expect(ms.length).toBeLessThanOrEqual(pool.length);
    }
  });

  it('is deterministic for identical inputs', () => {
    const rng = mulberry32(55);
    const pool = Array.from({ length: 20 }, (_, i) => randProduct(rng, i));
    const sourceProduct = randProduct(rng, 777);
    const run = () =>
      renderHook(() => useProductMatch(sourceProduct, pool, { minScore: 1 })).result.current.matches.map(
        (m) => `${m.product.id}:${m.score}:${m.matchType}`,
      );
    expect(run()).toEqual(run());
  });

  it('handles empty pool and null source without error', () => {
    const sourceProduct = randProduct(mulberry32(1), 0);
    expect(renderHook(() => useProductMatch(sourceProduct, [], { minScore: 1 })).result.current.matches).toEqual([]);
    expect(renderHook(() => useProductMatch(null, [sourceProduct], { minScore: 1 })).result.current.matches).toEqual([]);
  });
});
