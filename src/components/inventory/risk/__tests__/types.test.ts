import { describe, it, expect } from 'vitest';
import { deriveSeverity, SEVERITY_ORDER } from '../types';
import type { ProductStockSummary } from '@/types/stock';

const summary = (over: Partial<ProductStockSummary> = {}): ProductStockSummary => ({
  productId: 'p1',
  productName: 'Produto',
  productSku: 'SKU',
  totalCurrentStock: 100,
  totalMinStock: 10,
  totalReservedStock: 0,
  totalInTransitStock: 0,
  totalAvailableStock: 100,
  overallStatus: 'in_stock',
  variantsInStock: 1,
  variantsLowStock: 0,
  variantsCritical: 0,
  variantsOutOfStock: 0,
  totalVariants: 1,
  variants: [],
  availableColors: [],
  ...over,
});

describe('SEVERITY_ORDER', () => {
  it('orders critical < warning < ok', () => {
    expect(SEVERITY_ORDER.critical).toBe(0);
    expect(SEVERITY_ORDER.warning).toBe(1);
    expect(SEVERITY_ORDER.ok).toBe(2);
  });
});

describe('deriveSeverity', () => {
  it('treats incoming status as warning (mitigated)', () => {
    expect(deriveSeverity(summary({ overallStatus: 'incoming' }))).toBe('warning');
  });

  it('returns critical for out_of_stock', () => {
    expect(deriveSeverity(summary({ overallStatus: 'out_of_stock' }))).toBe('critical');
  });

  it('returns critical for critical status', () => {
    expect(deriveSeverity(summary({ overallStatus: 'critical' }))).toBe('critical');
  });

  it('returns critical when finite daysUntilFullStockout < 7', () => {
    expect(deriveSeverity(summary({ overallStatus: 'in_stock', daysUntilFullStockout: 3 }))).toBe(
      'critical',
    );
  });

  it('does NOT escalate to critical when daysUntilFullStockout is Infinity (#15 fix)', () => {
    expect(
      deriveSeverity(summary({ overallStatus: 'in_stock', daysUntilFullStockout: Infinity })),
    ).toBe('ok');
  });

  it('returns warning for low_stock status', () => {
    expect(deriveSeverity(summary({ overallStatus: 'low_stock' }))).toBe('warning');
  });

  it('returns warning when finite daysUntilFullStockout < 15', () => {
    expect(deriveSeverity(summary({ overallStatus: 'in_stock', daysUntilFullStockout: 10 }))).toBe(
      'warning',
    );
  });

  it('returns warning when variants are out of stock or critical', () => {
    expect(deriveSeverity(summary({ overallStatus: 'in_stock', variantsOutOfStock: 2 }))).toBe(
      'warning',
    );
    expect(deriveSeverity(summary({ overallStatus: 'in_stock', variantsCritical: 1 }))).toBe(
      'warning',
    );
  });

  it('returns ok for a healthy product', () => {
    expect(deriveSeverity(summary({ overallStatus: 'in_stock' }))).toBe('ok');
  });

  it('returns ok when daysUntilFullStockout is undefined and product healthy', () => {
    expect(
      deriveSeverity(summary({ overallStatus: 'in_stock', daysUntilFullStockout: undefined })),
    ).toBe('ok');
  });
});
