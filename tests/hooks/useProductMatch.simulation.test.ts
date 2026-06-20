/**
 * MONTE-CARLO SIMULATION / PROPERTY TESTS for the Match de Produtos engine.
 *
 * Generates thousands of randomized catalogue scenarios with a *seeded* PRNG
 * (fully reproducible) and asserts engine invariants that must hold for ANY
 * input. This is the "simulação de centenas de cenários" guard: it predicts
 * failures/gaps (type-mixed ids, NaN, unicode, empty pools, huge pools) before
 * they reach production.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateMatchScore,
  getMatchType,
  tokenizeName,
  nameTokenSimilarity,
  eqId,
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

const NAME_WORDS = [
  'Caneta', 'Caderno', 'Agenda', 'Bloco', 'Squeeze', 'Garrafa', 'Copo', 'Caneca',
  'Mochila', 'Necessaire', 'Camiseta', 'Boné', 'Mouse', 'Mousepad', 'Cabo',
  'Powerbank', 'Tábua', 'Faca', 'Avental', 'Toalha', 'Chinelo', 'Vinho', 'Taça',
  'Metal', 'Bambu', 'Inox', 'Plástico', 'Premium', 'Executiva', 'Azul', 'Preto',
  'Térmico', '350ml', 'A5', '2L', '🎯', 'Ação', 'Café',
];
const CATEGORY_IDS = ['cat-a', 'cat-b', 'cat-c', 'cat-d', null];
const SUPPLIER_IDS = ['sup-1', 'sup-2', 'sup-3', 'sup-4'];
const DESCRIPTORS = ['caneta', 'metal', 'bambu', 'inox', 'aromatizada', 'vela', 'parede dupla', ''];
const MATERIALS = ['Aço Inox', 'Bambu', 'Plástico', 'Metal', 'Algodão', 'Couro'];
const STOCK_STATES: Product['stockStatus'][] = ['in-stock', 'low-stock', 'out-of-stock'];

function pick<T>(rnd: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}
function sample<T>(rnd: () => number, arr: readonly T[], max: number): T[] {
  const n = Math.floor(rnd() * (max + 1));
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(pick(rnd, arr));
  return out;
}

function makeRandomProduct(rnd: () => number, id: string): Product {
  const words = sample(rnd, NAME_WORDS, 4);
  // ~5% chance of a numeric category id to stress type-mixed comparisons
  let categoryId: string | number | null = pick(rnd, CATEGORY_IDS);
  if (rnd() < 0.05 && categoryId) categoryId = Math.floor(rnd() * 4);
  // ~3% chance of a NaN/garbage price
  const price = rnd() < 0.03 ? NaN : Math.round(rnd() * 50000) / 100;
  return {
    id,
    name: words.join(' '),
    shortDescription: '',
    sku: 'SKU-' + id,
    price,
    images: [],
    stock: Math.floor(rnd() * 1000),
    colors: [],
    materials: sample(rnd, MATERIALS, 3),
    descriptiveTags: sample(rnd, DESCRIPTORS, 4),
    minQuantity: 1,
    stockStatus: pick(rnd, STOCK_STATES),
    featured: false,
    newArrival: false,
    onSale: false,
    isKit: false,
    category_id: categoryId as Product['category_id'],
    category: { id: (categoryId ?? '0') as string | number, name: 'Sem categoria' },
    supplier: { id: pick(rnd, SUPPLIER_IDS), name: 'F' },
    tags: { publicoAlvo: [], datasComemorativas: [], endomarketing: [], ramo: [], nicho: [] },
  } as Product;
}

const VALID_TYPES = new Set<MatchResult['matchType']>(['identical', 'similar', 'complementary']);

describe('Match engine — Monte-Carlo simulation (seeded, reproducible)', () => {
  it('holds all engine invariants across thousands of random scenarios', () => {
    const rnd = mulberry32(0xC0FFEE);
    let totalEvaluations = 0;

    for (let scenario = 0; scenario < 1200; scenario++) {
      const poolSize = 2 + Math.floor(rnd() * 40);
      const pool = Array.from({ length: poolSize }, (_, i) =>
        makeRandomProduct(rnd, `s${scenario}-p${i}`),
      );
      const source = pick(rnd, pool);

      for (const candidate of pool) {
        totalEvaluations++;
        // INVARIANT 1: never throws, score is a finite non-negative number.
        const { score, reasons } = calculateMatchScore(source, candidate);
        expect(Number.isFinite(score)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(0);

        // INVARIANT 2: classification is always a valid enum value.
        const hasComplementary = reasons.some((r) => r.startsWith('Complementar'));
        const sourceTokens = tokenizeName(source.name);
        const candTokens = tokenizeName(candidate.name);
        let shared = 0;
        sourceTokens.forEach((t) => candTokens.has(t) && shared++);
        const type = getMatchType({
          hasComplementary,
          nameSim: nameTokenSimilarity(sourceTokens, candTokens),
          sharedTokens: shared,
        });
        expect(VALID_TYPES.has(type)).toBe(true);

        // INVARIANT 3: complementary classification ⟺ a complementary reason exists.
        expect(type === 'complementary').toBe(hasComplementary);

        // INVARIANT 4: symmetric signals (category/supplier/tags/descriptors/materials)
        // are direction-independent — the only asymmetry allowed is complementary.
        const ab = calculateMatchScore(source, candidate);
        const ba = calculateMatchScore(candidate, source);
        const compAB = ab.reasons.some((r) => r.startsWith('Complementar'));
        const compBA = ba.reasons.some((r) => r.startsWith('Complementar'));
        if (!compAB && !compBA) {
          expect(ab.score).toBe(ba.score);
        }
      }
    }

    // Sanity: we really did simulate a large number of evaluations.
    expect(totalEvaluations).toBeGreaterThan(10000);
  });
});

describe('Match engine — targeted edge cases predicted by simulation', () => {
  it('eqId treats numeric and string ids as equal, and rejects empty/null', () => {
    expect(eqId(5, '5')).toBe(true);
    expect(eqId('cat-a', 'cat-a')).toBe(true);
    expect(eqId(5, 6)).toBe(false);
    expect(eqId(null, null)).toBe(false);
    expect(eqId('', '')).toBe(false);
    expect(eqId(undefined, '1')).toBe(false);
  });

  it('matches same category when ids differ in type (number vs string)', () => {
    const base = {
      shortDescription: '', sku: 'x', price: 1, images: [], stock: 1, colors: [],
      materials: [], minQuantity: 1, stockStatus: 'in-stock' as const, featured: false,
      newArrival: false, onSale: false, isKit: false, category: { id: 5, name: 'C' },
      supplier: { id: 's1', name: 'F' },
      tags: { publicoAlvo: [], datasComemorativas: [], endomarketing: [], ramo: [], nicho: [] },
    };
    const source = { ...base, id: '1', name: 'Caneta', category_id: 5 as unknown as string };
    const candidate = { ...base, id: '2', name: 'Caderno', category_id: '5' };
    const { score, reasons } = calculateMatchScore(source as Product, candidate as Product);
    expect(reasons).toContain('Mesma categoria');
    expect(score).toBeGreaterThanOrEqual(30);
  });

  it('does not crash on NaN price, empty name, or unicode-only name', () => {
    const mk = (over: Partial<Product>): Product =>
      ({
        id: 'x', name: '', shortDescription: '', sku: 'x', price: NaN, images: [], stock: 0,
        colors: [], materials: [], minQuantity: 1, stockStatus: 'in-stock', featured: false,
        newArrival: false, onSale: false, isKit: false, category_id: null,
        category: { id: '0', name: '' }, supplier: { id: 's', name: 'F' },
        tags: { publicoAlvo: [], datasComemorativas: [], endomarketing: [], ramo: [], nicho: [] },
        ...over,
      }) as Product;
    expect(() => calculateMatchScore(mk({ name: '' }), mk({ id: 'y', name: '🎯✨' }))).not.toThrow();
    expect(() => calculateMatchScore(mk({ name: '🎯' }), mk({ id: 'y', name: '' }))).not.toThrow();
  });
});
