import { describe, it, expect } from 'vitest';
import { productFormSchema } from '../ProductFormSchema';

describe('ProductFormSchema - Price Freshness', () => {
  it('should have price_freshness_threshold_days with default value 60', () => {
    const result = productFormSchema.safeParse({
      sku: 'SKU123',
      name: 'Test Product',
      supplier_id: 'SUPP123',
      sale_price: 10,
    });
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price_freshness_threshold_days).toBe(60);
    }
  });

  it('should allow setting price_freshness_threshold_days within range 1-365', () => {
    const validResult = productFormSchema.safeParse({
      sku: 'SKU123',
      name: 'Test Product',
      supplier_id: 'SUPP123',
      sale_price: 10,
      price_freshness_threshold_days: 120
    });
    expect(validResult.success).toBe(true);
    if (validResult.success) {
      expect(validResult.data.price_freshness_threshold_days).toBe(120);
    }

    const invalidResult = productFormSchema.safeParse({
      sku: 'SKU123',
      name: 'Test Product',
      supplier_id: 'SUPP123',
      sale_price: 10,
      price_freshness_threshold_days: 500
    });
    expect(invalidResult.success).toBe(false);
  });
});
