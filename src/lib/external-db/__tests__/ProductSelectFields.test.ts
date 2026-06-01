import { describe, it, expect } from 'vitest';
import {
  PRODUCT_SELECT_FIELDS_WITH_SALE,
  PRODUCT_SELECT_FIELDS_LEGACY,
  PRODUCT_SELECT_FIELDS_DETAIL,
} from '../product-types';

describe('Product Select Fields - Price Freshness', () => {
  it('should include price_freshness_threshold_days in main select fields', () => {
    expect(PRODUCT_SELECT_FIELDS_WITH_SALE).toContain('price_freshness_threshold_days');
    expect(PRODUCT_SELECT_FIELDS_LEGACY).toContain('price_freshness_threshold_days');
    expect(PRODUCT_SELECT_FIELDS_DETAIL).toContain('price_freshness_threshold_days');
  });
});
