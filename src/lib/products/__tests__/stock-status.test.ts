import { describe, it, expect } from 'vitest';
import {
  isProductInStock,
  isCatalogStockStatus,
  getVariationStockStatus,
  OUT_OF_STOCK,
  CATALOG_STOCK_STATUSES,
  type CatalogStockStatusValue,
} from '../stock-status';

// ── isProductInStock ──────────────────────────────────────────────────────────
describe('isProductInStock', () => {
  describe('sem variações — stockStatus canônico (catálogo, hífen)', () => {
    it('in-stock → true (even if stock=0)', () => {
      expect(isProductInStock({ stockStatus: 'in-stock', stock: 0 })).toBe(true);
    });
    it('low-stock → true', () => {
      expect(isProductInStock({ stockStatus: 'low-stock', stock: 5 })).toBe(true);
    });
    it('out-of-stock → false even if stock > 0 (min_quantity rule)', () => {
      expect(isProductInStock({ stockStatus: 'out-of-stock', stock: 5 })).toBe(false);
    });
    it('OUT-OF-STOCK maiúsculo → false (case-insensitive, GAP-STOCK-CASE-01)', () => {
      expect(isProductInStock({ stockStatus: 'OUT-OF-STOCK', stock: 50 })).toBe(false);
    });
    it('OUT_OF_STOCK exportado = "out-of-stock"', () => {
      expect(OUT_OF_STOCK).toBe('out-of-stock');
    });
  });

  describe('sem variações — three-way: status desconhecido faz fallthrough', () => {
    // Status de domínio inventário (underscore) são desconhecidos → fallthrough ao stock
    it('in_stock (underscore) + stock=50 → true (fallthrough)', () => {
      expect(isProductInStock({ stockStatus: 'in_stock', stock: 50 })).toBe(true);
    });
    it('in_stock (underscore) + stock=0 → false (fallthrough)', () => {
      expect(isProductInStock({ stockStatus: 'in_stock', stock: 0 })).toBe(false);
    });
    it('critical + stock=5 → true (fallthrough)', () => {
      expect(isProductInStock({ stockStatus: 'critical', stock: 5 })).toBe(true);
    });
    it('pending + stock=0 → false (fallthrough)', () => {
      expect(isProductInStock({ stockStatus: 'pending', stock: 0 })).toBe(false);
    });
  });

  describe('sem variações — fallback por stock bruto', () => {
    it('stock > 0 sem stockStatus → true', () => {
      expect(isProductInStock({ stock: 10 })).toBe(true);
      expect(isProductInStock({ stock: 0.5 })).toBe(true);
    });
    it('stock = 0 → false', () => {
      expect(isProductInStock({ stock: 0, stockStatus: null })).toBe(false);
    });
    it('stock = null/undefined → false', () => {
      expect(isProductInStock({ stock: null })).toBe(false);
      expect(isProductInStock({ stock: undefined })).toBe(false);
    });
    it('stock = NaN → false (BUG-PRICE-NaN-02 alinhado)', () => {
      expect(isProductInStock({ stock: NaN })).toBe(false);
    });
    it('stock = Infinity → false (BUG-STOCK-INF-01)', () => {
      expect(isProductInStock({ stock: Infinity })).toBe(false);
    });
    it('stock = -1 negativo → false', () => {
      expect(isProductInStock({ stock: -1 })).toBe(false);
    });
  });

  describe('com variações — fallback por stock sem stockStatus', () => {
    it('uma variação stock=5 → true', () => {
      expect(isProductInStock({ variations: [{ stock: 0 }, { stock: 5 }] })).toBe(true);
    });
    it('todas stock=0 → false', () => {
      expect(isProductInStock({ variations: [{ stock: 0 }, { stock: 0 }] })).toBe(false);
    });
    it('todas stock=null → false', () => {
      expect(isProductInStock({ variations: [{ stock: null }, { stock: null }] })).toBe(false);
    });
    it('ignora produto.stockStatus quando variações presentes', () => {
      expect(isProductInStock({ variations: [{ stock: 10 }], stockStatus: 'out-of-stock' })).toBe(true);
    });
    it('variations=[] vazia → cai para produto.stockStatus out-of-stock → false', () => {
      expect(isProductInStock({ variations: [], stockStatus: 'out-of-stock', stock: 0 })).toBe(false);
    });
  });

  describe('com variações — stockStatus por variação (GAP-VAR-MINQTY-01)', () => {
    it('var stockStatus=out-of-stock + stock=5 → false (status prevalece)', () => {
      expect(isProductInStock({ variations: [{ stock: 5, stockStatus: 'out-of-stock' }] })).toBe(false);
    });
    it('var stockStatus=in-stock → true', () => {
      expect(isProductInStock({ variations: [{ stock: 10, stockStatus: 'in-stock' }] })).toBe(true);
    });
    it('var1=out-of-stock + var2=in-stock → true (uma disponível)', () => {
      expect(isProductInStock({ variations: [
        { stock: 3, stockStatus: 'out-of-stock' },
        { stock: 15, stockStatus: 'in-stock' },
      ]})).toBe(true);
    });
  });
});

// ── isCatalogStockStatus ──────────────────────────────────────────────────────
describe('isCatalogStockStatus', () => {
  it('aceita valores válidos (exact match, case-sensitive)', () => {
    expect(isCatalogStockStatus('in-stock')).toBe(true);
    expect(isCatalogStockStatus('low-stock')).toBe(true);
    expect(isCatalogStockStatus('out-of-stock')).toBe(true);
  });
  it('rejeita casing diferente', () => {
    expect(isCatalogStockStatus('IN-STOCK')).toBe(false);
    expect(isCatalogStockStatus('OUT-OF-STOCK')).toBe(false);
  });
  it('rejeita underscore / outros domínios', () => {
    expect(isCatalogStockStatus('in_stock')).toBe(false);
    expect(isCatalogStockStatus('critical')).toBe(false);
  });
  it('rejeita primitivos não-string', () => {
    expect(isCatalogStockStatus(null)).toBe(false);
    expect(isCatalogStockStatus(undefined)).toBe(false);
    expect(isCatalogStockStatus(1)).toBe(false);
    expect(isCatalogStockStatus(true)).toBe(false);
    expect(isCatalogStockStatus('')).toBe(false);
  });
});

// ── getVariationStockStatus ───────────────────────────────────────────────────
describe('getVariationStockStatus', () => {
  it('stock=0 → out-of-stock', () => { expect(getVariationStockStatus(0)).toBe('out-of-stock'); });
  it('stock=null → out-of-stock', () => { expect(getVariationStockStatus(null)).toBe('out-of-stock'); });
  it('stock=Infinity → out-of-stock', () => { expect(getVariationStockStatus(Infinity)).toBe('out-of-stock'); });
  it('stock=1 → low-stock (1 < threshold=10)', () => { expect(getVariationStockStatus(1)).toBe('low-stock'); });
  it('stock=10 → in-stock', () => { expect(getVariationStockStatus(10)).toBe('in-stock'); });
  it('stock=3 minQty=5 → out-of-stock (3 < 5)', () => { expect(getVariationStockStatus(3, 5)).toBe('out-of-stock'); });
  it('stock=5 minQty=5 → low-stock (>=min, <threshold)', () => { expect(getVariationStockStatus(5, 5)).toBe('low-stock'); });
  it('stock=10 minQty=5 → in-stock', () => { expect(getVariationStockStatus(10, 5)).toBe('in-stock'); });
  it('retorna CatalogStockStatusValue (tipo válido)', () => {
    const r: CatalogStockStatusValue = getVariationStockStatus(5, 3);
    expect(CATALOG_STOCK_STATUSES).toContain(r);
  });
});

// ── CATALOG_STOCK_STATUSES ───────────────────────────────────────────────────
describe('CATALOG_STOCK_STATUSES', () => {
  it('tem exatamente 3 valores', () => { expect(CATALOG_STOCK_STATUSES).toHaveLength(3); });
  it('contém in-stock, low-stock, out-of-stock', () => {
    expect(CATALOG_STOCK_STATUSES).toContain('in-stock');
    expect(CATALOG_STOCK_STATUSES).toContain('low-stock');
    expect(CATALOG_STOCK_STATUSES).toContain('out-of-stock');
  });
  it('todos são strings com hífen', () => {
    CATALOG_STOCK_STATUSES.forEach(s => {
      expect(typeof s).toBe('string');
      expect(s).toMatch(/-/);
    });
  });
});
