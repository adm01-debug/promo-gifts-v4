import { describe, it, expect, beforeEach } from 'vitest';
import { sortProducts } from '@/utils/product-sorting';
import { SORT_OPTIONS } from '@/constants/filters';
import type { Product, SupplierSalesEntry } from '@/hooks/products';

/**
 * Bateria de testes validando o seletor de "Relevância" e demais
 * opções de ordenação do módulo de produtos.
 *
 * Cobre todas as 8 opções expostas em SORT_OPTIONS:
 *  - relevance, name, price-asc, price-desc, newest, stock,
 *    best-seller-supplier, best-seller-promo
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
  } as unknown as Product);

const baseProducts = (): Product[] => [
  makeProduct({ id: '1', name: 'Caneta Zebra',  price: 10, stock: 5,   created_at: '2024-01-01', featured: false, newArrival: false }),
  makeProduct({ id: '2', name: 'Agenda Alfa',   price: 50, stock: 100, created_at: '2025-06-01', featured: true,  newArrival: true  }),
  makeProduct({ id: '3', name: 'Mochila Beta',  price: 30, stock: 50,  created_at: '2024-12-15', featured: false, newArrival: true  }),
  makeProduct({ id: '4', name: 'Garrafa Gama',  price: 80, stock: 0,   created_at: '2023-03-10', featured: true,  newArrival: false }),
];

describe('SORT_OPTIONS — contrato do seletor', () => {
  it('expõe exatamente as 8 opções esperadas, na ordem da UI', () => {
    expect(SORT_OPTIONS.map(o => o.value)).toEqual([
      'relevance',
      'name',
      'price-asc',
      'price-desc',
      'newest',
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

  it('opção "relevance" tem label "Relevância (Busca)"', () => {
    const r = SORT_OPTIONS.find(o => o.value === 'relevance');
    expect(r?.label).toBe('Relevância (Busca)');
  });
});

describe('sortProducts — Relevância (Busca)', () => {
  it('preserva a ordem de entrada (ranking da busca já aplicado)', () => {
    const input = baseProducts();
    const expected = input.map(p => p.id);
    const result = sortProducts([...input], 'relevance').map(p => p.id);
    expect(result).toEqual(expected);
  });

  it('é estável: chamadas repetidas mantêm a mesma ordem', () => {
    const input = baseProducts();
    const a = sortProducts([...input], 'relevance').map(p => p.id);
    const b = sortProducts([...input], 'relevance').map(p => p.id);
    expect(a).toEqual(b);
  });

  it('com array vazio retorna array vazio', () => {
    expect(sortProducts([], 'relevance')).toEqual([]);
  });

  it('respeita skipSort (não altera ordem mesmo em outros modos)', () => {
    const input = baseProducts();
    const result = sortProducts([...input], 'name', { skipSort: true });
    expect(result.map(p => p.id)).toEqual(input.map(p => p.id));
  });
});

describe('sortProducts — Nome (A-Z)', () => {
  it('ordena alfabeticamente respeitando locale PT-BR', () => {
    const result = sortProducts(baseProducts(), 'name').map(p => p.name);
    expect(result).toEqual(['Agenda Alfa', 'Caneta Zebra', 'Garrafa Gama', 'Mochila Beta']);
  });
});

describe('sortProducts — Preço', () => {
  it('Menor Preço: ordena ascendente', () => {
    const result = sortProducts(baseProducts(), 'price-asc').map(p => p.price);
    expect(result).toEqual([10, 30, 50, 80]);
  });

  it('Maior Preço: ordena descendente', () => {
    const result = sortProducts(baseProducts(), 'price-desc').map(p => p.price);
    expect(result).toEqual([80, 50, 30, 10]);
  });
});

describe('sortProducts — Lançamentos (newest)', () => {
  it('mais recentes primeiro com base em created_at', () => {
    const result = sortProducts(baseProducts(), 'newest').map(p => p.id);
    expect(result).toEqual(['2', '3', '1', '4']);
  });

  it('tolera created_at ausente (trata como 0/epoch)', () => {
    const input: Product[] = [
      makeProduct({ id: 'a', created_at: undefined as any }),
      makeProduct({ id: 'b', created_at: '2025-01-01' }),
    ];
    const result = sortProducts(input, 'newest').map(p => p.id);
    expect(result[0]).toBe('b');
  });
});

describe('sortProducts — Maior Estoque', () => {
  it('ordena por stock descendente', () => {
    const result = sortProducts(baseProducts(), 'stock').map(p => p.stock);
    expect(result).toEqual([100, 50, 5, 0]);
  });

  it('produtos sem stock (undefined) vão para o final', () => {
    const input: Product[] = [
      makeProduct({ id: 'a', stock: undefined as any }),
      makeProduct({ id: 'b', stock: 10 }),
    ];
    const result = sortProducts(input, 'stock').map(p => p.id);
    expect(result).toEqual(['b', 'a']);
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
    const result = sortProducts(baseProducts(), 'best-seller-supplier', { supplierSalesMap }).map(p => p.id);
    // 2 (score 90), 4 (score 50, vel 8), 3 (score 50, vel 3), 1 (score 10)
    expect(result).toEqual(['2', '4', '3', '1']);
  });

  it('desempate por velocity7d quando turnoverScore empata', () => {
    const supplierSalesMap = new Map<string, SupplierSalesEntry>([
      ['a', { turnoverScore: 5, velocity7d: 2 } as SupplierSalesEntry],
      ['b', { turnoverScore: 5, velocity7d: 9 } as SupplierSalesEntry],
    ]);
    const input = [makeProduct({ id: 'a' }), makeProduct({ id: 'b' })];
    const result = sortProducts(input, 'best-seller-supplier', { supplierSalesMap }).map(p => p.id);
    expect(result).toEqual(['b', 'a']);
  });

  it('fallback: usa flags featured/newArrival quando map vazio', () => {
    const result = sortProducts(baseProducts(), 'best-seller-supplier', { supplierSalesMap: new Map() }).map(p => p.id);
    // scores: 1=0, 2=3 (feat+new), 3=1 (new), 4=2 (feat) -> 2,4,3,1
    expect(result).toEqual(['2', '4', '3', '1']);
  });

  it('fallback: desempate por stock descendente quando flags empatam', () => {
    const input = [
      makeProduct({ id: 'a', featured: false, newArrival: false, stock: 5 }),
      makeProduct({ id: 'b', featured: false, newArrival: false, stock: 50 }),
    ];
    const result = sortProducts(input, 'best-seller-supplier').map(p => p.id);
    expect(result).toEqual(['b', 'a']);
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
    const result = sortProducts(baseProducts(), 'best-seller-promo', { promoSalesMap }).map(p => p.id);
    expect(result).toEqual(['2', '4', '1', '3']);
  });

  it('desempate alfabético quando contagem empata', () => {
    const promoSalesMap = new Map<string, number>([['1', 5], ['2', 5], ['3', 5], ['4', 5]]);
    const result = sortProducts(baseProducts(), 'best-seller-promo', { promoSalesMap }).map(p => p.name);
    expect(result).toEqual(['Agenda Alfa', 'Caneta Zebra', 'Garrafa Gama', 'Mochila Beta']);
  });

  it('quando promoSalesMap ausente, trata todas como 0 e cai no desempate alfabético', () => {
    const result = sortProducts(baseProducts(), 'best-seller-promo').map(p => p.name);
    expect(result).toEqual(['Agenda Alfa', 'Caneta Zebra', 'Garrafa Gama', 'Mochila Beta']);
  });
});

describe('sortProducts — robustez e edge cases', () => {
  let products: Product[];
  beforeEach(() => { products = baseProducts(); });

  it('sortBy desconhecido não altera a ordem (no-op seguro)', () => {
    const result = sortProducts([...products], 'sort-inexistente').map(p => p.id);
    expect(result).toEqual(products.map(p => p.id));
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

  it('não lança erro com produtos contendo campos faltantes', () => {
    const broken: Product[] = [
      makeProduct({ id: 'p1', name: 'A', price: undefined as any, stock: undefined as any, created_at: undefined as any }),
      makeProduct({ id: 'p2', name: 'B', price: 10, stock: 1, created_at: '2025-01-01' }),
    ];
    for (const opt of SORT_OPTIONS) {
      expect(() => sortProducts([...broken], opt.value)).not.toThrow();
    }
  });
});
