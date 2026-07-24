/**
 * Unit tests for generateStockAlerts (stockAlerts.ts).
 *
 * Run: TZ=America/Sao_Paulo npx vitest run src/hooks/stock/__tests__/stockAlerts.test.ts
 */
import { describe, it, expect } from 'vitest';
import { generateStockAlerts } from '@/hooks/stock/stockAlerts';
import type { ProductStockSummary, VariantStock } from '@/types/stock';

const variant = (over: Partial<VariantStock> = {}): VariantStock => ({
  id: 'v1',
  productId: 'p1',
  variantId: 'v1',
  variantSku: 'SKU-1',
  colorName: 'Azul',
  currentStock: 5,
  minStock: 10,
  reservedStock: 0,
  inTransitStock: 0,
  availableStock: 5,
  status: 'in_stock',
  updatedAt: '2026-06-18T00:00:00.000Z',
  ...over,
});

const product = (
  variants: VariantStock[],
  over: Partial<ProductStockSummary> = {},
): ProductStockSummary => ({
  productId: 'p1',
  productName: 'Caneca',
  productSku: 'CAN-001',
  totalCurrentStock: 0,
  totalMinStock: 0,
  totalReservedStock: 0,
  totalInTransitStock: 0,
  totalAvailableStock: 0,
  overallStatus: 'in_stock',
  variantsInStock: 0,
  variantsLowStock: 0,
  variantsCritical: 0,
  variantsOutOfStock: 0,
  totalVariants: variants.length,
  variants,
  availableColors: [],
  ...over,
});

describe('generateStockAlerts', () => {
  it('produces no alerts for an in_stock variant with healthy days remaining', () => {
    const alerts = generateStockAlerts([
      product([variant({ status: 'in_stock', daysUntilStockout: 30 })]),
    ]);
    expect(alerts).toEqual([]);
  });

  it('emits an out_of_stock alert (error) for an out_of_stock variant', () => {
    const alerts = generateStockAlerts([
      product([variant({ status: 'out_of_stock', currentStock: 0, daysUntilStockout: undefined })]),
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('out_of_stock');
    expect(alerts[0].severity).toBe('error');
    expect(alerts[0].id).toBe('alert-v1-out');
    expect(alerts[0].productName).toBe('Caneca');
    expect(alerts[0].threshold).toBe(10);
  });

  it('emits a critical alert for a critical variant', () => {
    const alerts = generateStockAlerts([
      product([variant({ status: 'critical', currentStock: 2, daysUntilStockout: undefined })]),
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('critical');
    expect(alerts[0].severity).toBe('error');
    expect(alerts[0].id).toBe('alert-v1-critical');
    expect(alerts[0].message).toContain('2 unidades');
    expect(alerts[0].message).toContain('10');
  });

  it('emits a low_stock alert (warning) for a low_stock variant', () => {
    const alerts = generateStockAlerts([
      product([variant({ status: 'low_stock', currentStock: 5, daysUntilStockout: undefined })]),
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('low_stock');
    expect(alerts[0].severity).toBe('warning');
    expect(alerts[0].id).toBe('alert-v1-low');
  });

  it('emits a stockout_predicted alert when daysUntilStockout <= 7 and not out_of_stock', () => {
    const alerts = generateStockAlerts([
      product([variant({ status: 'in_stock', daysUntilStockout: 5 })]),
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('stockout_predicted');
    expect(alerts[0].severity).toBe('warning');
    expect(alerts[0].message).toContain('5 dias');
  });

  it('does NOT emit a prediction alert for an out_of_stock variant even with low days', () => {
    // out_of_stock => the predicted branch is suppressed (status !== out_of_stock guard)
    const alerts = generateStockAlerts([
      product([variant({ status: 'out_of_stock', currentStock: 0, daysUntilStockout: 3 })]),
    ]);
    // only the out_of_stock alert, no prediction alert
    expect(alerts.map((a) => a.type)).toEqual(['out_of_stock']);
  });

  it('does NOT emit a prediction alert when daysUntilStockout is undefined', () => {
    const alerts = generateStockAlerts([
      product([variant({ status: 'in_stock', daysUntilStockout: undefined })]),
    ]);
    expect(alerts).toEqual([]);
  });

  it('emits BOTH a critical and a prediction alert when applicable', () => {
    const alerts = generateStockAlerts([
      product([variant({ status: 'critical', currentStock: 1, daysUntilStockout: 2 })]),
    ]);
    expect(alerts).toHaveLength(2);
    expect(alerts.map((a) => a.type).sort()).toEqual(['critical', 'stockout_predicted']);
  });

  it('falls back to "Variação" in messages when colorName is absent', () => {
    const alerts = generateStockAlerts([
      product([variant({ colorName: undefined, status: 'out_of_stock', currentStock: 0 })]),
    ]);
    expect(alerts[0].message).toContain('Variação');
  });

  it('falls back to "Variação" for critical / low / predicted messages too', () => {
    const critical = generateStockAlerts([
      product([
        variant({
          id: 'vc',
          variantId: 'vc',
          colorName: undefined,
          status: 'critical',
          currentStock: 1,
          daysUntilStockout: undefined,
        }),
      ]),
    ]);
    expect(critical[0].message).toContain('Variação');

    const low = generateStockAlerts([
      product([
        variant({
          id: 'vl',
          variantId: 'vl',
          colorName: undefined,
          status: 'low_stock',
          currentStock: 3,
          daysUntilStockout: undefined,
        }),
      ]),
    ]);
    expect(low[0].message).toContain('Variação');

    const predicted = generateStockAlerts([
      product([
        variant({
          id: 'vp',
          variantId: 'vp',
          colorName: undefined,
          status: 'in_stock',
          daysUntilStockout: 4,
        }),
      ]),
    ]);
    expect(predicted[0].message).toContain('Variação');
  });

  it('sorts errors before warnings', () => {
    const alerts = generateStockAlerts([
      product([
        variant({ id: 'vA', variantId: 'vA', status: 'in_stock', daysUntilStockout: 3 }), // warning prediction
        variant({ id: 'vB', variantId: 'vB', status: 'out_of_stock', currentStock: 0 }), // error
      ]),
    ]);
    expect(alerts[0].severity).toBe('error');
    expect(alerts[alerts.length - 1].severity).toBe('warning');
  });

  it('handles a boundary daysUntilStockout of exactly 7', () => {
    const alerts = generateStockAlerts([
      product([variant({ status: 'in_stock', daysUntilStockout: 7 })]),
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('stockout_predicted');
  });

  it('returns an empty array for products with no variants', () => {
    expect(generateStockAlerts([product([])])).toEqual([]);
  });
});
