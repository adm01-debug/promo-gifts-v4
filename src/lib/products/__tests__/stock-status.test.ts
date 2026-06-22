import { describe, it, expect } from 'vitest';
import { isProductInStock } from '../stock-status';

describe('isProductInStock', () => {
  describe('products without variations (simple stock + stockStatus)', () => {
    it('returns true when stockStatus is in_stock', () => {
      expect(isProductInStock({ stockStatus: 'in_stock', stock: 50 })).toBe(true);
    });

    it('returns false when stockStatus is out-of-stock even if stock > 0 (min_quantity rule)', () => {
      expect(isProductInStock({ stockStatus: 'out-of-stock', stock: 5 })).toBe(false);
    });

    it('falls back to stock > 0 when stockStatus is absent', () => {
      expect(isProductInStock({ stock: 10 })).toBe(true);
      expect(isProductInStock({ stock: 0 })).toBe(false);
      expect(isProductInStock({ stock: null })).toBe(false);
    });

    it('returns false when stock is 0 and no stockStatus', () => {
      expect(isProductInStock({ stock: 0, stockStatus: null })).toBe(false);
    });
  });

  describe('products with variations', () => {
    it('returns true when at least one variation has stock > 0', () => {
      expect(
        isProductInStock({
          variations: [{ stock: 0 }, { stock: 5 }],
        }),
      ).toBe(true);
    });

    it('returns false when all variations have stock = 0', () => {
      expect(
        isProductInStock({
          variations: [{ stock: 0 }, { stock: 0 }],
        }),
      ).toBe(false);
    });

    it('returns false when all variations have stock = null', () => {
      expect(
        isProductInStock({
          variations: [{ stock: null }, { stock: null }],
        }),
      ).toBe(false);
    });

    it('ignores product-level stockStatus when variations are present', () => {
      // Even if stockStatus says out-of-stock, a variation with stock > 0 wins
      expect(
        isProductInStock({
          variations: [{ stock: 10 }],
          stockStatus: 'out-of-stock',
          stock: 0,
        }),
      ).toBe(true);
    });

    it('returns false for empty variations array (falls through to stockStatus path)', () => {
      expect(
        isProductInStock({
          variations: [],
          stockStatus: 'out-of-stock',
          stock: 0,
        }),
      ).toBe(false);
    });
  });
});
