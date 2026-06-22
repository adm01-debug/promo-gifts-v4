import { describe, it, expect } from 'vitest';
import { sortProducts } from '../product-sorting';
import type { Product } from '@/types/product-catalog';

function p(id: string, price: number | null | undefined): Product {
  return { id, name: `Produto ${id}`, price } as unknown as Product;
}

describe('sortProducts — price-asc', () => {
  it('sorts ascending by price, nulls last', () => {
    const products = [p('c', null), p('a', 30), p('b', 10)];
    const result = sortProducts(products, 'price-asc');
    expect(result.map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('NaN guard: all-null prices produce deterministic id tiebreak (no NaN scramble)', () => {
    const products = [p('z', null), p('a', null), p('m', null)];
    const result = sortProducts(products, 'price-asc');
    expect(result.map((x) => x.id)).toEqual(['a', 'm', 'z']);
  });

  it('equal prices defer to id tiebreak', () => {
    const products = [p('z', 10), p('a', 10), p('m', 10)];
    const result = sortProducts(products, 'price-asc');
    expect(result.map((x) => x.id)).toEqual(['a', 'm', 'z']);
  });
});

describe('sortProducts — price-desc', () => {
  it('sorts descending by price, nulls last', () => {
    const products = [p('a', 10), p('b', null), p('c', 30)];
    const result = sortProducts(products, 'price-desc');
    expect(result.map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });

  it('NaN guard: all-null prices produce deterministic id tiebreak (no NaN scramble)', () => {
    const products = [p('z', null), p('a', null), p('m', null)];
    const result = sortProducts(products, 'price-desc');
    expect(result.map((x) => x.id)).toEqual(['a', 'm', 'z']);
  });

  it('equal prices defer to id tiebreak', () => {
    const products = [p('z', 99), p('a', 99), p('m', 99)];
    const result = sortProducts(products, 'price-desc');
    expect(result.map((x) => x.id)).toEqual(['a', 'm', 'z']);
  });
});

describe('sortProducts — name-asc / name-desc', () => {
  it('name-asc: "Caneta 2" < "Caneta 10" (numeric collation)', () => {
    const products = [p('a', 1), p('b', 1)].map((x, i) => ({
      ...x,
      name: i === 0 ? 'Caneta 10' : 'Caneta 2',
      id: i === 0 ? 'a' : 'b',
    })) as unknown as Product[];
    const result = sortProducts(products, 'name-asc');
    expect(result[0].name).toBe('Caneta 2');
  });

  it('name-desc reverses the name-asc order', () => {
    const items = [
      { ...p('a', 0), name: 'Água' },
      { ...p('b', 0), name: 'Zebra' },
    ] as unknown as Product[];
    const asc = sortProducts(items, 'name-asc').map((x) => x.name);
    const desc = sortProducts(items, 'name-desc').map((x) => x.name);
    expect(desc).toEqual([...asc].reverse());
  });
});

describe('sortProducts — non-mutating', () => {
  it('does not mutate the input array', () => {
    const original = [p('b', 20), p('a', 10)];
    const originalOrder = original.map((x) => x.id);
    sortProducts(original, 'price-asc');
    expect(original.map((x) => x.id)).toEqual(originalOrder);
  });
});

describe('sortProducts — unknown sortBy (no-op)', () => {
  it('unknown sort key preserves current order', () => {
    const products = [p('c', 30), p('a', 10), p('b', 20)];
    const result = sortProducts(products, 'not-a-real-sort' as string);
    expect(result.map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });
});
