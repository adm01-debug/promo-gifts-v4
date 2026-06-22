import { describe, it, expect } from 'vitest';
import { isProductInStock, type InStockProduct } from '@/lib/products/stock-status';
import { getCatalogStockStatus, CATALOG_LOW_STOCK_THRESHOLD } from '@/lib/catalog-stock-status';
import { sortProducts } from '@/utils/product-sorting';
import type { Product } from '@/types/product-catalog';

function p(o: Partial<InStockProduct> = {}): InStockProduct {
  return { stock: null, stockStatus: null, variations: undefined, ...o };
}
function s(id: string, price: number | null | undefined): Product {
  return { id, name: 'P-' + id, price } as unknown as Product;
}

// ── A. isProductInStock ───────────────────────────────────────────────────────
describe('A1 — stockStatus canônicos (hífen)', () => {
  it('in-stock → true', () => { expect(isProductInStock(p({ stockStatus: 'in-stock', stock: 50 }))).toBe(true); });
  it('low-stock → true', () => { expect(isProductInStock(p({ stockStatus: 'low-stock', stock: 5 }))).toBe(true); });
  it('out-of-stock → false', () => { expect(isProductInStock(p({ stockStatus: 'out-of-stock', stock: 0 }))).toBe(false); });
  it('out-of-stock com stock=413 → false (BUG-CF-INSTOCK-01)', () => {
    expect(isProductInStock(p({ stockStatus: 'out-of-stock', stock: 413 }))).toBe(false);
  });
  it('in-stock com stock=0 → true (stockStatus prevalece)', () => {
    expect(isProductInStock(p({ stockStatus: 'in-stock', stock: 0 }))).toBe(true);
  });
  it('low-stock com stock=1 → true', () => { expect(isProductInStock(p({ stockStatus: 'low-stock', stock: 1 }))).toBe(true); });
});

describe('A2 — GAP: case sensitivity', () => {
  it('OUT-OF-STOCK maiúsculo → true GAP documentado', () => {
    expect(isProductInStock(p({ stockStatus: 'OUT-OF-STOCK', stock: 5 }))).toBe(true);
  });
  it('out_of_stock underscore com stock>0 → true GAP cross-domain', () => {
    expect(isProductInStock(p({ stockStatus: 'out_of_stock', stock: 5 }))).toBe(true);
  });
  it('critical tipo inventario → true', () => { expect(isProductInStock(p({ stockStatus: 'critical', stock: 2 }))).toBe(true); });
  it('string vazia falsy → fallback stock>0 true', () => { expect(isProductInStock(p({ stockStatus: '', stock: 5 }))).toBe(true); });
  it('string vazia falsy → fallback stock=0 false', () => { expect(isProductInStock(p({ stockStatus: '', stock: 0 }))).toBe(false); });
});

describe('A3 — fallback por stock (sem stockStatus)', () => {
  it('stock=0 → false', () => { expect(isProductInStock(p({ stock: 0 }))).toBe(false); });
  it('stock=1 → true', () => { expect(isProductInStock(p({ stock: 1 }))).toBe(true); });
  it('stock=null → false', () => { expect(isProductInStock(p({ stock: null }))).toBe(false); });
  it('stock=undefined → false', () => { expect(isProductInStock(p({ stock: undefined }))).toBe(false); });
  it('stock=-1 negativo → false', () => { expect(isProductInStock(p({ stock: -1 }))).toBe(false); });
  it('stock=0.5 fracional → true (sem minQty)', () => { expect(isProductInStock(p({ stock: 0.5 }))).toBe(true); });
  it('stock=NaN → false', () => { expect(isProductInStock(p({ stock: NaN }))).toBe(false); });
  it('stock=1000000 → true', () => { expect(isProductInStock(p({ stock: 1000000 }))).toBe(true); });
});

describe('A4 — produtos COM variações', () => {
  it('1 variação stock=1 → true', () => { expect(isProductInStock(p({ variations: [{ stock: 1 }] }))).toBe(true); });
  it('todas variações stock=0 → false', () => { expect(isProductInStock(p({ variations: [{ stock: 0 }, { stock: 0 }] }))).toBe(false); });
  it('todas variações stock=null → false', () => { expect(isProductInStock(p({ variations: [{ stock: null }] }))).toBe(false); });
  it('todas variações stock=undefined → false', () => { expect(isProductInStock(p({ variations: [{ stock: undefined }] }))).toBe(false); });
  it('variações mistas [-1, 3] → true', () => { expect(isProductInStock(p({ variations: [{ stock: -1 }, { stock: 3 }] }))).toBe(true); });
  it('variação stock=-5 única → false', () => { expect(isProductInStock(p({ variations: [{ stock: -5 }] }))).toBe(false); });
  it('ignora stockStatus quando variações presentes', () => {
    expect(isProductInStock(p({ variations: [{ stock: 10 }], stockStatus: 'out-of-stock' }))).toBe(true);
  });
  it('GAP: variação stock=3 sem minQty → true mesmo se minQty=5', () => {
    expect(isProductInStock(p({ variations: [{ stock: 3 }] }))).toBe(true);
  });
  it('variations=[] vazio → cai para stockStatus out-of-stock → false', () => {
    expect(isProductInStock(p({ variations: [], stockStatus: 'out-of-stock' }))).toBe(false);
  });
  it('variations=[] vazio → cai para stock → true', () => {
    expect(isProductInStock(p({ variations: [], stockStatus: null, stock: 5 }))).toBe(true);
  });
  it('variations=null → cai para stockStatus', () => { expect(isProductInStock(p({ variations: null, stockStatus: 'in-stock' }))).toBe(true); });
  it('objeto variação vazio {} → false', () => { expect(isProductInStock(p({ variations: [{}] }))).toBe(false); });
  it('variações com stock=0.5 → true', () => { expect(isProductInStock(p({ variations: [{ stock: 0.5 }] }))).toBe(true); });
});

describe('A5 — 413 produtos BUG-CF-INSTOCK-01', () => {
  function mkBug(stock: number, minQty: number): InStockProduct {
    return p({ stock, stockStatus: getCatalogStockStatus(stock, CATALOG_LOW_STOCK_THRESHOLD, minQty) });
  }
  it('stock=3 minQty=5 → out-of-stock → false', () => {
    const prod = mkBug(3, 5);
    expect(prod.stockStatus).toBe('out-of-stock');
    expect(isProductInStock(prod)).toBe(false);
  });
  it('stock=1 minQty=100 → false', () => { expect(isProductInStock(mkBug(1, 100))).toBe(false); });
  it('stock=99 minQty=100 → false', () => { expect(isProductInStock(mkBug(99, 100))).toBe(false); });
  it('stock=100 minQty=100 → true', () => { expect(isProductInStock(mkBug(100, 100))).toBe(true); });
  it('stock=9 minQty=10 → false (exclusivo)', () => { expect(isProductInStock(mkBug(9, 10))).toBe(false); });
  it('stock=10 minQty=10 → true (inclusivo)', () => { expect(isProductInStock(mkBug(10, 10))).toBe(true); });
  it('413 produtos: todos out-of-stock, todos excluídos, lógica bugada inclui todos', () => {
    const catalog = Array.from({ length: 413 }, (_, i) => {
      const stock = (i % 50) + 1;
      const minQty = stock + 1 + (i % 10);
      return mkBug(stock, minQty);
    });
    expect(catalog.every(x => x.stockStatus === 'out-of-stock')).toBe(true);
    expect(catalog.filter(isProductInStock)).toHaveLength(0);
    expect(catalog.filter(x => (x.stock || 0) > 0)).toHaveLength(413);
  });
});

// ── B. getCatalogStockStatus ──────────────────────────────────────────────────
describe('B1 — getCatalogStockStatus: boundaries', () => {
  it('stock=0 → out-of-stock', () => { expect(getCatalogStockStatus(0)).toBe('out-of-stock'); });
  it('stock=-1 → out-of-stock', () => { expect(getCatalogStockStatus(-1)).toBe('out-of-stock'); });
  it('stock=null → out-of-stock', () => { expect(getCatalogStockStatus(null)).toBe('out-of-stock'); });
  it('stock=undefined → out-of-stock', () => { expect(getCatalogStockStatus(undefined)).toBe('out-of-stock'); });
  it('stock=NaN → out-of-stock', () => { expect(getCatalogStockStatus(NaN)).toBe('out-of-stock'); });
  it('stock=Infinity → out-of-stock', () => { expect(getCatalogStockStatus(Infinity)).toBe('out-of-stock'); });
  it('stock=-Infinity → out-of-stock', () => { expect(getCatalogStockStatus(-Infinity)).toBe('out-of-stock'); });
  it('stock=1 → low-stock', () => { expect(getCatalogStockStatus(1)).toBe('low-stock'); });
  it('stock=9 → low-stock', () => { expect(getCatalogStockStatus(9)).toBe('low-stock'); });
  it('stock=10 → in-stock', () => { expect(getCatalogStockStatus(10)).toBe('in-stock'); });
  it('stock=1000000 → in-stock', () => { expect(getCatalogStockStatus(1000000)).toBe('in-stock'); });
  it('threshold=5: stock=4 → low-stock', () => { expect(getCatalogStockStatus(4, 5)).toBe('low-stock'); });
  it('threshold=5: stock=5 → in-stock', () => { expect(getCatalogStockStatus(5, 5)).toBe('in-stock'); });
  it('threshold=1: stock=1 → in-stock', () => { expect(getCatalogStockStatus(1, 1)).toBe('in-stock'); });
  it('threshold=0: stock=1 → in-stock', () => { expect(getCatalogStockStatus(1, 0)).toBe('in-stock'); });
  it('stock=0.5 sem minQty → low-stock', () => { expect(getCatalogStockStatus(0.5, 10)).toBe('low-stock'); });
});

describe('B2 — getCatalogStockStatus: minOrderQuantity', () => {
  it('minQty=50 stock=49 → out-of-stock', () => { expect(getCatalogStockStatus(49, 10, 50)).toBe('out-of-stock'); });
  it('minQty=50 stock=50 → in-stock', () => { expect(getCatalogStockStatus(50, 10, 50)).toBe('in-stock'); });
  it('minQty=50 stock=51 → in-stock', () => { expect(getCatalogStockStatus(51, 10, 50)).toBe('in-stock'); });
  it('minQty=0 → não aplica', () => { expect(getCatalogStockStatus(5, 10, 0)).toBe('low-stock'); });
  it('minQty=null → não aplica', () => { expect(getCatalogStockStatus(5, 10, null)).toBe('low-stock'); });
  it('minQty=NaN → não aplica', () => { expect(getCatalogStockStatus(5, 10, NaN)).toBe('low-stock'); });
  it('minQty=Infinity → não aplica', () => { expect(getCatalogStockStatus(5, 10, Infinity)).toBe('low-stock'); });
  it('stock=0.5 minQty=1 → out-of-stock', () => { expect(getCatalogStockStatus(0.5, 10, 1)).toBe('out-of-stock'); });
  it('stock=1 minQty=1 → low-stock (satisfaz min, abaixo threshold)', () => { expect(getCatalogStockStatus(1, 10, 1)).toBe('low-stock'); });
  it('stock=10 minQty=1 threshold=5 → in-stock', () => { expect(getCatalogStockStatus(10, 5, 1)).toBe('in-stock'); });
});

describe('B3 — getCatalogStockStatus ↔ isProductInStock: SSOT consistente', () => {
  const matrix: Array<[number, number | undefined]> = [
    [0, 1], [1, 1], [1, 2], [2, 2], [9, 10], [10, 10],
    [49, 50], [50, 50], [99, 100], [100, 100], [100, 50],
    [5, 1], [5, 5], [4, 5], [0, undefined], [1, undefined],
    [999, 1000], [1000, 1000],
  ];
  matrix.forEach(([stock, minQty]) => {
    it('stock=' + stock + ' minQty=' + minQty + ' — consistente', () => {
      const status = getCatalogStockStatus(stock, CATALOG_LOW_STOCK_THRESHOLD, minQty);
      expect(isProductInStock({ stock, stockStatus: status })).toBe(status !== 'out-of-stock');
    });
  });
  it('50 pares deterministicos: zero divergencias', () => {
    let fail = 0;
    for (let i = 0; i < 50; i++) {
      const stock = (i * 7) % 20;
      const minQty: number | undefined = (i * 3) % 15 || undefined;
      const status = getCatalogStockStatus(stock, CATALOG_LOW_STOCK_THRESHOLD, minQty);
      if (isProductInStock({ stock, stockStatus: status }) !== (status !== 'out-of-stock')) fail++;
    }
    expect(fail).toBe(0);
  });
});

// ── C. sortProducts NaN guard ─────────────────────────────────────────────────
describe('C1 — price-asc NaN guard', () => {
  it('3 nulls → ordem por id', () => {
    expect(sortProducts([s('z', null), s('a', null), s('m', null)], 'price-asc').map(x => x.id)).toEqual(['a', 'm', 'z']);
  });
  it('null e real → real primeiro', () => {
    expect(sortProducts([s('b', null), s('a', 5)], 'price-asc').map(x => x.id)).toEqual(['a', 'b']);
  });
  it('undefined e real → real primeiro', () => {
    expect(sortProducts([s('b', undefined), s('a', 5)], 'price-asc').map(x => x.id)).toEqual(['a', 'b']);
  });
  it('precos iguais → desempate por id', () => {
    expect(sortProducts([s('z', 10), s('a', 10), s('m', 10)], 'price-asc').map(x => x.id)).toEqual(['a', 'm', 'z']);
  });
  it('price=0 real vem antes de null', () => {
    expect(sortProducts([s('b', null), s('a', 0)], 'price-asc').map(x => x.id)).toEqual(['a', 'b']);
  });
  it('NAO muta o original', () => {
    const orig = [s('b', 20), s('a', 10)];
    sortProducts([...orig], 'price-asc');
    expect(orig.map(x => x.id)).toEqual(['b', 'a']);
  });
  it('100 produtos: idempotente', () => {
    const items = Array.from({ length: 100 }, (_, i) => s(String(i).padStart(3, '0'), i % 3 === 0 ? null : (i * 7) % 50));
    const a = sortProducts([...items], 'price-asc').map(x => x.id);
    const b = sortProducts([...items], 'price-asc').map(x => x.id);
    expect(a).toEqual(b);
  });
  it('vazio → vazio', () => { expect(sortProducts([], 'price-asc')).toEqual([]); });
  it('1 produto → retorna o mesmo', () => { expect(sortProducts([s('x', 42)], 'price-asc').map(x => x.id)).toEqual(['x']); });
  it('20 nulls: ordem deterministica por id', () => {
    const items = Array.from({ length: 20 }, (_, i) => s(String(20 - i), null));
    const r = sortProducts(items, 'price-asc').map(x => x.id);
    expect(r).toEqual([...r].sort());
  });
  it('GAP price=NaN explicito: produto real vem primeiro', () => {
    const items = [s('z', NaN), s('a', NaN), s('b', 5)];
    expect(sortProducts(items, 'price-asc')[0].id).toBe('b');
  });
});

describe('C2 — price-desc NaN guard', () => {
  it('2 nulls → ordem por id', () => {
    expect(sortProducts([s('z', null), s('a', null)], 'price-desc').map(x => x.id)).toEqual(['a', 'z']);
  });
  it('null e real → real primeiro em desc', () => {
    const r = sortProducts([s('b', null), s('a', 100), s('c', 50)], 'price-desc');
    expect(r.map(x => x.id)).toEqual(['a', 'c', 'b']);
  });
  it('price=0 vem antes de null em desc', () => {
    const r = sortProducts([s('a', null), s('b', 0), s('c', 5)], 'price-desc');
    expect(r.map(x => x.id)).toEqual(['c', 'b', 'a']);
  });
  it('100 produtos: idempotente em desc', () => {
    const items = Array.from({ length: 100 }, (_, i) => s(String(i).padStart(3, '0'), i % 5 === 0 ? null : (i * 13) % 100));
    const a = sortProducts([...items], 'price-desc').map(x => x.id);
    const b = sortProducts([...items], 'price-desc').map(x => x.id);
    expect(a).toEqual(b);
  });
  it('precos iguais em desc → desempate por id', () => {
    expect(sortProducts([s('z', 99), s('a', 99), s('m', 99)], 'price-desc').map(x => x.id)).toEqual(['a', 'm', 'z']);
  });
  it('nulls em asc e desc: mesma ordem de id', () => {
    const items = [s('c', null), s('a', null), s('b', null)];
    const asc = sortProducts([...items], 'price-asc').map(x => x.id);
    const desc = sortProducts([...items], 'price-desc').map(x => x.id);
    expect(asc).toEqual(desc);
  });
});

describe('C3 — outras ordenacoes', () => {
  it('name-asc numerico: Caneta 2 < Caneta 10', () => {
    const items = [{ ...s('a', 0), name: 'Caneta 10' }, { ...s('b', 0), name: 'Caneta 2' }] as unknown as Product[];
    expect(sortProducts(items, 'name-asc')[0].name).toBe('Caneta 2');
  });
  it('name-desc: reverso de name-asc', () => {
    const items = [{ ...s('a', 0), name: 'Agua' }, { ...s('b', 0), name: 'Zebra' }] as unknown as Product[];
    const asc = sortProducts([...items], 'name-asc').map(x => x.name);
    const desc = sortProducts([...items], 'name-desc').map(x => x.name);
    expect(desc).toEqual([...asc].reverse());
  });
  it('sort desconhecido preserva ordem', () => {
    const items = [s('c', 30), s('a', 10), s('b', 20)];
    expect(sortProducts(items, 'invalid' as string).map(x => x.id)).toEqual(['c', 'a', 'b']);
  });
});

// ── D. Simulação produção 200 produtos ────────────────────────────────────────
describe('D — Simulacao producao: 200 produtos', () => {
  const catalog: InStockProduct[] = [
    ...Array.from({ length: 50 }, (_, i) => {
      const stock = i * 3;
      const minQty = i % 5 === 0 ? i + 1 : 1;
      return p({ stock, stockStatus: getCatalogStockStatus(stock, CATALOG_LOW_STOCK_THRESHOLD, minQty) });
    }),
    ...Array.from({ length: 50 }, (_, i) => p({ stock: i, stockStatus: null })),
    ...Array.from({ length: 50 }, (_, i) => p({
      variations: [{ stock: i % 3 === 0 ? 0 : i }, { stock: i % 7 === 0 ? 5 : 0 }],
    })),
    ...(([
      p({ stock: null, stockStatus: null }),
      p({ stock: 0, stockStatus: null }),
      p({ stock: 1, stockStatus: 'in-stock' }),
      p({ stock: 5, stockStatus: 'out-of-stock' }),
      p({ stock: undefined, stockStatus: undefined }),
      p({ variations: [], stock: 10, stockStatus: 'in-stock' }),
      p({ variations: [{ stock: null }], stockStatus: 'in-stock' }),
      p({ stock: -1, stockStatus: null }),
      p({ stock: 0.5, stockStatus: null }),
      p({ stock: 999, stockStatus: 'low-stock' }),
    ] as InStockProduct[]).flatMap(x => Array.from({ length: 5 }, () => x))),
  ];

  it('200 produtos no catalogo', () => { expect(catalog).toHaveLength(200); });
  it('nenhum retornado tem out-of-stock sem variacoes', () => {
    const bad = catalog.filter(isProductInStock).filter(x => !x.variations?.length && x.stockStatus === 'out-of-stock');
    expect(bad).toHaveLength(0);
  });
  it('nenhum retornado tem stock<=0 sem stockStatus e sem variacoes', () => {
    const bad = catalog.filter(isProductInStock).filter(x =>
      !x.variations?.length && !x.stockStatus && (x.stock == null || (x.stock || 0) <= 0)
    );
    expect(bad).toHaveLength(0);
  });
  it('idempotente: aplicar duas vezes = mesmo resultado', () => {
    const once = catalog.filter(isProductInStock).length;
    const twice = catalog.filter(isProductInStock).filter(isProductInStock).length;
    expect(twice).toBe(once);
  });
  it('excluidos sao realmente out-of-stock', () => {
    catalog.filter(x => !isProductInStock(x)).forEach(x => {
      expect(isProductInStock(x)).toBe(false);
    });
  });
  it('corrigida exclui >= produtos que a bugada (nunca mais permissiva)', () => {
    const bug = catalog.filter(x => x.variations?.length ? x.variations.some(v => (v.stock ?? 0) > 0) : (x.stock || 0) > 0).length;
    const fix = catalog.filter(isProductInStock).length;
    expect(fix).toBeLessThanOrEqual(bug);
  });
});
