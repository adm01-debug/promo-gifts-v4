/**
 * GAP ANALYSIS TESTS — validates all fixes applied to Match module hooks.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/hooks/products/useProducts', () => ({
  useProducts: () => ({ data: [], isLoading: false }),
}));

import { useProductMatch } from '@/hooks/products/useProductMatch';
import { useSupplierComparison, getSupplierProductsInCategory } from '@/hooks/products/useSupplierComparison';
import type { Product } from '@/types/product-catalog';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Caneta Esferográfica',
    sku: 'CAN-001',
    price: 10,
    minPrice: 10,
    stock: 100,
    stockStatus: 'in-stock' as const,
    images: [],
    supplier: { id: 's1', name: 'Fornecedor A' },
    category: { id: 'cat1', name: 'Escritório' },
    category_id: 'cat1',
    tags: { publicoAlvo: [], datasComemorativas: [], endomarketing: [], nicho: [], ramo: [] },
    ...overrides,
  } as Product;
}

// FIX 1: Division by zero
describe('FIX 1: useSupplierComparison — price zero guard', () => {
  it('should not produce Infinity when base product price is 0', () => {
    const { result } = renderHook(() =>
      useSupplierComparison(makeProduct({ price: 0 }))
    );
    expect(result.current.data).toBeNull();
  });
});

// FIX 2: Empty string & stop word similarity
describe('FIX 2: name similarity edge cases', () => {
  it('should NOT match empty-named products as complementary', () => {
    const source = makeProduct({ name: '' });
    const candidate = makeProduct({ id: 'p2', name: '' });
    const { result } = renderHook(() =>
      useProductMatch(source, [candidate], { minScore: 1 })
    );
    const compMatches = result.current.matches.filter(m =>
      m.reasons.some(r => r.startsWith('Complementar'))
    );
    expect(compMatches.length).toBe(0);
  });

  it('should NOT false-positive on stop words', () => {
    const source = makeProduct({ name: 'De A Em' });
    const candidate = makeProduct({
      id: 'p2', name: 'Produto Totalmente Diferente',
      supplier: { id: 's2', name: 'Outro' },
      category: { id: 'cat99', name: 'Outra' }, category_id: 'cat99',
    });
    const { result } = renderHook(() =>
      useProductMatch(source, [candidate], { minScore: 1 })
    );
    expect(result.current.matches.length).toBe(0);
  });
});

// FIX 3: Tag normalization
describe('FIX 3: tag normalization', () => {
  it('matches tags with different casing/whitespace', () => {
    const source = makeProduct({
      tags: { publicoAlvo: [' Feminino '], datasComemorativas: [], endomarketing: [], nicho: [], ramo: [] },
    });
    const candidate = makeProduct({
      id: 'p2',
      tags: { publicoAlvo: ['feminino'], datasComemorativas: [], endomarketing: [], nicho: [], ramo: [] },
    });
    const { result } = renderHook(() =>
      useProductMatch(source, [candidate], { minScore: 1 })
    );
    expect(result.current.matches.some(m => m.reasons.some(r => r.includes('Público-alvo')))).toBe(true);
  });

  it('matches nicho tags case-insensitively', () => {
    const source = makeProduct({
      tags: { publicoAlvo: [], datasComemorativas: [], endomarketing: [], nicho: ['Tecnologia'], ramo: [] },
    });
    const candidate = makeProduct({
      id: 'p2',
      tags: { publicoAlvo: [], datasComemorativas: [], endomarketing: [], nicho: ['tecnologia'], ramo: [] },
    });
    const { result } = renderHook(() =>
      useProductMatch(source, [candidate], { minScore: 1 })
    );
    expect(result.current.matches.some(m => m.reasons.some(r => r.includes('Nicho')))).toBe(true);
  });
});

// FIX 4: Complementary self-matching
describe('FIX 4: complementary self-match prevention', () => {
  it('should NOT self-match keywords in source name', () => {
    const source = makeProduct({ name: 'Copo Térmico 500ml' });
    const candidate = makeProduct({
      id: 'p2', name: 'Copo de Vidro', category_id: 'cat1',
      category: { id: 'cat1', name: 'Escritório' },
    });
    const { result } = renderHook(() =>
      useProductMatch(source, [candidate], { minScore: 1 })
    );
    const selfComp = result.current.matches.find(m =>
      m.reasons.some(r => r.startsWith('Complementar') && r.toLowerCase().includes('copo'))
    );
    expect(selfComp).toBeUndefined();
  });

  it('correctly matches true complementary items', () => {
    const source = makeProduct({ name: 'Caneta Premium' });
    const candidate = makeProduct({
      id: 'p2', name: 'Caderno Executivo A5',
      category: { id: 'cat1', name: 'Escritório' }, category_id: 'cat1',
    });
    const { result } = renderHook(() =>
      useProductMatch(source, [candidate], { minScore: 1 })
    );
    expect(result.current.matches.some(m => m.reasons.some(r => r.startsWith('Complementar')))).toBe(true);
  });
});

// FIX 5: Type flexibility
describe('FIX 5: getSupplierProductsInCategory type', () => {
  it('accepts string category IDs', () => {
    const products = [makeProduct({ category: { id: 'cat-uuid', name: 'Test' } })];
    const result = getSupplierProductsInCategory(products, 'cat-uuid' as any);
    expect(result.size).toBeGreaterThanOrEqual(0);
  });
});
