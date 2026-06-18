import { describe, it, expect, beforeEach } from 'vitest';
import { sortProducts } from '@/utils/product-sorting';
import { SORT_OPTIONS } from '@/constants/filters';
import type { Product, SupplierSalesEntry } from '@/hooks/products';

/**
 * Bateria de testes validando as opções de ordenação do catálogo.
 *
 * Agora com 7 opções (Removidos: relevance, store-default)
 */

const makeProduct = (overrides: Partial<Product>): Product =>
  ({
    id: 'x',
    name: 'Produto X',
    sku: 'SKU-X',
    price: 0,
    stock: 0,
    colors: [],
    supplier: { id: 's', name: 'S' },
    brand: 'B',
    materials: [],
    category_id: 'c',
    featured: false,
    newArrival: false,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }) as unknown as Product;

const baseProducts = (): Product[] => [
  makeProduct({
    id: '1',
    name: 'Caneta Zebra',
    price: 10,
    stock: 5,
    created_at: '2024-01-01',
    featured: false,
    newArrival: false,
  }),
  makeProduct({
    id: '2',
    name: 'Agenda Alfa',
    price: 50,
    stock: 100,
    created_at: '2025-06-01',
    featured: true,
    newArrival: true,
  }),
  makeProduct({
    id: '3',
    name: 'Mochila Beta',
    price: 30,
    stock: 50,
    created_at: '2024-12-15',
    featured: false,
    newArrival: true,
  }),
  makeProduct({
    id: '4',
    name: 'Garrafa Gama',
    price: 80,
    stock: 0,
    created_at: '2023-03-10',
    featured: true,
    newArrival: false,
  }),
];

describe('SORT_OPTIONS — contrato do seletor', () => {
  it('expõe exatamente as 7 opções esperadas, na ordem da UI', () => {
    expect(SORT_OPTIONS.map((o) => o.value)).toEqual([
      'newest',
      'name',
      'price-asc',
      'price-desc',
      'stock',
      'best-seller-supplier',
      'best-seller-promo',
    ]);
  });

  it('todas as opções têm label não vazia', () => {
    for (const opt of SORT_OPTIONS) {
      expect(opt.label).toBeTruthy();
      expect(opt.label.length).toBeGreaterThan(0);
    }
  });
});

describe('sortProducts — Nome (A-Z)', () => {
  it('ordena alfabeticamente respeitando locale PT-BR', () => {
    const result = sortProducts(baseProducts(), 'name').map((p) => p.name);
    expect(result).toEqual(['Agenda Alfa', 'Caneta Zebra', 'Garrafa Gama', 'Mochila Beta']);
  });
});

describe('sortProducts — Preço', () => {
  it('Menor Preço: ordena ascendente', () => {
    const result = sortProducts(baseProducts(), 'price-asc').map((p) => p.price);
    expect(result).toEqual([10, 30, 50, 80]);
  });

  it('Maior Preço: ordena descendente', () => {
    const result = sortProducts(baseProducts(), 'price-desc').map((p) => p.price);
    expect(result).toEqual([80, 50, 30, 10]);
  });
});

describe('sortProducts — Lançamentos (newest)', () => {
  it('mais recentes primeiro com base em created_at', () => {
    const result = sortProducts(baseProducts(), 'newest').map((p) => p.id);
    expect(result).toEqual(['2', '3', '1', '4']);
  });
});

describe('sortProducts — Maior Estoque', () => {
  it('ordena por stock descendente', () => {
    const result = sortProducts(baseProducts(), 'stock').map((p) => p.stock);
    expect(result).toEqual([100, 50, 5, 0]);
  });
});

describe('sortProducts — + Vendidos (Indústria)', () => {
  it('usa supplierSalesMap (turnoverScore) quando disponível', () => {
    const supplierSalesMap = new Map<string, SupplierSalesEntry>([
      ['1', { turnoverScore: 10, velocity7d: 1 } as SupplierSalesEntry],
      ['2', { turnoverScore: 90, velocity7d: 5 } as SupplierSalesEntry],
      ['3', { turnoverScore: 50, velocity7d: 3 } as SupplierSalesEntry],
      ['4', { turnoverScore: 50, velocity7d: 8 } as SupplierSalesEntry],
    ]);
    const result = sortProducts(baseProducts(), 'best-seller-supplier', { supplierSalesMap }).map(
      (p) => p.id,
    );
    expect(result).toEqual(['2', '4', '3', '1']);
  });
});

describe('sortProducts — + Vendidos (Promo)', () => {
  it('ordena por contagem de vendas do promoSalesMap (desc)', () => {
    const promoSalesMap = new Map<string, number>([
      ['1', 3],
      ['2', 99],
      ['3', 0],
      ['4', 12],
    ]);
    const result = sortProducts(baseProducts(), 'best-seller-promo', { promoSalesMap }).map(
      (p) => p.id,
    );
    expect(result).toEqual(['2', '4', '1', '3']);
  });
});

describe('sortProducts — robustez e edge cases', () => {
  let products: Product[];
  beforeEach(() => {
    products = baseProducts();
  });

  it('sortBy desconhecido não altera a ordem (no-op seguro)', () => {
    const result = sortProducts([...products], 'sort-inexistente').map((p) => p.id);
    expect(result).toEqual(products.map((p) => p.id));
  });

  it('lista com 1 produto retorna o mesmo produto em qualquer modo', () => {
    const single = [makeProduct({ id: 'only', name: 'Único', price: 7, stock: 1 })];
    for (const opt of SORT_OPTIONS) {
      const result = sortProducts([...single], opt.value);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('only');
    }
  });

  it('lista vazia funciona em todas as opções do seletor', () => {
    for (const opt of SORT_OPTIONS) {
      expect(sortProducts([], opt.value)).toEqual([]);
    }
  });
});
