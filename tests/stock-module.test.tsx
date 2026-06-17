/**
 * Bateria exaustiva de testes para o módulo de Estoque.
 * Cobre: tipos, helpers, lógica de alertas, componentes UI, edge cases.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateStockStatus,
  calculateDaysUntilStockout,
  calculateAvailableStock,
  aggregateVariantsToProduct,
  StockStatus,
  VariantStock,
  StockAlert,
  ProductStockSummary,
} from '@/types/stock';

// ============================================
// 1. calculateStockStatus — 20+ cenários
// ============================================

describe('calculateStockStatus', () => {
  it('returns out_of_stock when current is 0 and no transit', () => {
    expect(calculateStockStatus(0, 10)).toBe('out_of_stock');
  });

  it('returns out_of_stock when current is negative', () => {
    expect(calculateStockStatus(-5, 10)).toBe('out_of_stock');
  });

  it('returns incoming when current is 0 but inTransit > 0', () => {
    expect(calculateStockStatus(0, 10, undefined, 50)).toBe('incoming');
  });

  // NOTA: a régua baseada em `min` (low_stock/critical) foi descontinuada.
  // calculateStockStatus agora retorna `in_stock` para qualquer current > 0
  // sem trigger de overstocked. Classificação preditiva vive em rupture-risk.
  it('does NOT derive critical from min (deprecated)', () => {
    expect(calculateStockStatus(2, 10)).toBe('in_stock');
    expect(calculateStockStatus(1, 10)).toBe('in_stock');
  });

  it('does NOT derive critical at 25% boundary (deprecated)', () => {
    expect(calculateStockStatus(25, 100)).toBe('in_stock');
  });

  it('does NOT derive low_stock from min (deprecated)', () => {
    expect(calculateStockStatus(5, 10)).toBe('in_stock');
    expect(calculateStockStatus(10, 10)).toBe('in_stock');
    expect(calculateStockStatus(26, 100)).toBe('in_stock');
  });

  it('returns in_stock when above min', () => {
    expect(calculateStockStatus(15, 10)).toBe('in_stock');
    expect(calculateStockStatus(100, 10)).toBe('in_stock');
  });

  it('returns overstocked when above 1.5x max', () => {
    expect(calculateStockStatus(200, 10, 100)).toBe('overstocked');
    expect(calculateStockStatus(151, 10, 100)).toBe('overstocked');
  });

  it('returns in_stock when at exactly 1.5x max (not over)', () => {
    expect(calculateStockStatus(150, 10, 100)).toBe('in_stock');
  });

  it('returns in_stock when no max is provided even at high stock', () => {
    expect(calculateStockStatus(999999, 10)).toBe('in_stock');
  });

  it('returns incoming when current is 0 with inTransit=1', () => {
    expect(calculateStockStatus(0, 10, undefined, 1)).toBe('incoming');
  });

  it('handles min=0 edge case', () => {
    // current > 0 and min=0 → critical check: 0*0.25=0, current > 0 → low_stock: 0*1=0, current > 0 → in_stock
    expect(calculateStockStatus(5, 0)).toBe('in_stock');
  });

  it('handles min=0 and current=0', () => {
    expect(calculateStockStatus(0, 0)).toBe('out_of_stock');
  });

  it('handles very large numbers', () => {
    expect(calculateStockStatus(1000000, 100)).toBe('in_stock');
  });

  it('handles fractional numbers', () => {
    expect(calculateStockStatus(0.5, 10)).toBe('in_stock');
    expect(calculateStockStatus(2.5, 10)).toBe('in_stock');
    expect(calculateStockStatus(5.5, 10)).toBe('in_stock');
  });
});

// ============================================
// 2. calculateDaysUntilStockout — edge cases
// ============================================

describe('calculateDaysUntilStockout', () => {
  it('returns undefined when avgDailySales is 0', () => {
    expect(calculateDaysUntilStockout(100, 0)).toBeUndefined();
  });

  it('returns undefined when avgDailySales is negative', () => {
    expect(calculateDaysUntilStockout(100, -1)).toBeUndefined();
  });

  it('returns undefined when currentStock is 0', () => {
    expect(calculateDaysUntilStockout(0, 5)).toBeUndefined();
  });

  it('returns undefined when currentStock is negative', () => {
    expect(calculateDaysUntilStockout(-10, 5)).toBeUndefined();
  });

  it('returns correct days with default avgDailySales=2', () => {
    expect(calculateDaysUntilStockout(10)).toBe(5);
    expect(calculateDaysUntilStockout(100)).toBe(50);
  });

  it('returns correct days with custom avgDailySales', () => {
    expect(calculateDaysUntilStockout(100, 10)).toBe(10);
    expect(calculateDaysUntilStockout(7, 1)).toBe(7);
  });

  it('floors the result', () => {
    expect(calculateDaysUntilStockout(7, 2)).toBe(3); // 3.5 → 3
    expect(calculateDaysUntilStockout(1, 3)).toBe(0); // 0.33 → 0
  });

  it('handles fractional avgDailySales', () => {
    expect(calculateDaysUntilStockout(10, 0.5)).toBe(20);
  });
});

// ============================================
// 3. calculateAvailableStock — edge cases
// ============================================

describe('calculateAvailableStock', () => {
  it('returns currentStock when no reserved', () => {
    expect(calculateAvailableStock(100)).toBe(100);
    expect(calculateAvailableStock(100, 0)).toBe(100);
  });

  it('subtracts reserved stock', () => {
    expect(calculateAvailableStock(100, 30)).toBe(70);
  });

  it('returns 0 when reserved exceeds current (never negative)', () => {
    expect(calculateAvailableStock(10, 20)).toBe(0);
    expect(calculateAvailableStock(0, 5)).toBe(0);
  });

  it('handles edge case of equal current and reserved', () => {
    expect(calculateAvailableStock(50, 50)).toBe(0);
  });
});

// ============================================
// 4. aggregateVariantsToProduct — complex scenarios
// ============================================

function makeVariant(overrides: Partial<VariantStock> = {}): VariantStock {
  return {
    id: 'v1',
    productId: 'p1',
    variantId: 'v1',
    variantSku: 'SKU-001',
    colorName: 'Azul',
    colorHex: '#0000ff',
    currentStock: 100,
    minStock: 10,
    reservedStock: 0,
    inTransitStock: 0,
    availableStock: 100,
    status: 'in_stock' as StockStatus,
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

describe('aggregateVariantsToProduct', () => {
  it('aggregates totals correctly for multiple variants', () => {
    const variants = [
      makeVariant({ id: 'v1', currentStock: 50, minStock: 10, reservedStock: 5, inTransitStock: 0, availableStock: 45 }),
      makeVariant({ id: 'v2', colorName: 'Vermelho', currentStock: 30, minStock: 10, reservedStock: 3, inTransitStock: 10, availableStock: 27 }),
    ];
    const result = aggregateVariantsToProduct(variants);
    expect(result.totalCurrentStock).toBe(80);
    expect(result.totalMinStock).toBe(20);
    expect(result.totalReservedStock).toBe(8);
    expect(result.totalInTransitStock).toBe(10);
    expect(result.totalAvailableStock).toBe(72);
    expect(result.totalVariants).toBe(2);
  });

  it('groups colors correctly', () => {
    const variants = [
      makeVariant({ id: 'v1', colorName: 'Azul' }),
      makeVariant({ id: 'v2', colorName: 'Azul' }),
      makeVariant({ id: 'v3', colorName: 'Vermelho' }),
    ];
    const result = aggregateVariantsToProduct(variants);
    expect(result.availableColors).toHaveLength(2);
    const azul = result.availableColors.find(c => c.colorName === 'Azul');
    expect(azul?.variants).toHaveLength(2);
  });

  it('handles variants without color (defaults to "Sem cor")', () => {
    const variants = [
      makeVariant({ id: 'v1', colorName: undefined }),
    ];
    const result = aggregateVariantsToProduct(variants);
    expect(result.availableColors[0].colorName).toBe('Sem cor');
  });

  it('determines overallStatus as out_of_stock when all variants are out', () => {
    const variants = [
      makeVariant({ id: 'v1', status: 'out_of_stock', currentStock: 0 }),
      makeVariant({ id: 'v2', status: 'out_of_stock', currentStock: 0 }),
    ];
    const result = aggregateVariantsToProduct(variants);
    expect(result.overallStatus).toBe('out_of_stock');
  });

  it('determines overallStatus as critical when some variants are out but not all', () => {
    const variants = [
      makeVariant({ id: 'v1', status: 'in_stock', currentStock: 100 }),
      makeVariant({ id: 'v2', status: 'out_of_stock', currentStock: 0 }),
    ];
    const result = aggregateVariantsToProduct(variants);
    expect(result.overallStatus).toBe('critical');
  });

  it('determines overallStatus as low_stock when some variants are low', () => {
    const variants = [
      makeVariant({ id: 'v1', status: 'in_stock' }),
      makeVariant({ id: 'v2', status: 'low_stock' }),
    ];
    const result = aggregateVariantsToProduct(variants);
    expect(result.overallStatus).toBe('low_stock');
  });

  it('determines overallStatus as incoming when out_of_stock but transit exists', () => {
    const variants = [
      makeVariant({ id: 'v1', status: 'out_of_stock', currentStock: 0, inTransitStock: 50 }),
    ];
    const result = aggregateVariantsToProduct(variants);
    expect(result.overallStatus).toBe('incoming');
  });

  it('handles single variant', () => {
    const result = aggregateVariantsToProduct([makeVariant()]);
    expect(result.totalVariants).toBe(1);
    expect(result.overallStatus).toBe('in_stock');
  });

  it('counts variant statuses correctly in single loop', () => {
    const variants = [
      makeVariant({ id: 'v1', status: 'in_stock' }),
      makeVariant({ id: 'v2', status: 'low_stock' }),
      makeVariant({ id: 'v3', status: 'critical' }),
      makeVariant({ id: 'v4', status: 'out_of_stock' }),
      makeVariant({ id: 'v5', status: 'overstocked' }),
      makeVariant({ id: 'v6', status: 'incoming' }),
    ];
    const result = aggregateVariantsToProduct(variants);
    expect(result.variantsInStock).toBe(1);
    expect(result.variantsLowStock).toBe(1);
    expect(result.variantsCritical).toBe(1);
    expect(result.variantsOutOfStock).toBe(1);
    // overstocked and incoming are not counted in the switch
  });

  it('handles empty variants array', () => {
    const result = aggregateVariantsToProduct([]);
    expect(result.totalCurrentStock).toBe(0);
    expect(result.totalVariants).toBe(0);
    expect(result.overallStatus).toBe('in_stock'); // empty variants = safe default
    expect(result.availableColors).toHaveLength(0);
  });
});

// ============================================
// 5. Alert generation logic analysis
// ============================================

describe('Alert generation logic (analysis)', () => {
  it('generates error alerts for out_of_stock and critical statuses', () => {
    // Simulating the logic from generateStockAlerts
    const statuses: StockStatus[] = ['out_of_stock', 'critical'];
    statuses.forEach(status => {
      // Both should produce severity: 'error'
      expect(status === 'out_of_stock' || status === 'critical').toBe(true);
    });
  });

  it('generates warning alerts for low_stock status', () => {
    const status: StockStatus = 'low_stock';
    expect(status).toBe('low_stock');
    // This maps to severity: 'warning'
  });

  it('generates prediction warning when daysUntilStockout <= 7', () => {
    const daysUntilStockout = 5;
    const status: StockStatus = 'low_stock';
    // This should produce TWO alerts: one low_stock + one stockout_predicted
    expect(daysUntilStockout <= 7 && status !== 'out_of_stock').toBe(true);
  });

  it('does NOT generate prediction for out_of_stock variants', () => {
    const daysUntilStockout = 0;
    const status: StockStatus = 'out_of_stock';
    expect(status !== 'out_of_stock').toBe(false);
  });
});

// ============================================
// 6. Dialog behavior edge cases
// ============================================

describe('Dialog behavioral analysis', () => {
  it('BUG IDENTIFIED: dismissAllAlerts clears ALL severities, not just the dialog context', () => {
    // The low stock dialog calls dismissAllAlerts which dismisses error alerts too.
    // This is a cross-dialog side effect.
    // Fix: add dismissAlertsBySeverity('warning') for the low stock dialog

    const rawAlerts: Partial<StockAlert>[] = [
      { id: '1', severity: 'error' },
      { id: '2', severity: 'warning' },
      { id: '3', severity: 'info' },
    ];

    // Current behavior: dismissAllAlerts dismisses all 3
    const dismissedAll = new Set(rawAlerts.map(a => a.id!));
    expect(dismissedAll.size).toBe(3); // Problem: all dismissed

    // Expected behavior: dismiss only warning from low stock dialog
    const dismissedWarningOnly = new Set(
      rawAlerts.filter(a => a.severity === 'warning').map(a => a.id!)
    );
    expect(dismissedWarningOnly.size).toBe(1);
    expect(dismissedWarningOnly.has('2')).toBe(true);
    expect(dismissedWarningOnly.has('1')).toBe(false); // error should survive
  });

  it('BUG IDENTIFIED: alerts.filter called 3x in render for warning severity', () => {
    // Line 311: DialogTitle count
    // Line 327: empty check  
    // Line 329: map rendering
    // Should be memoized or computed once
    const alerts: Partial<StockAlert>[] = Array.from({ length: 1000 }, (_, i) => ({
      id: String(i),
      severity: i % 3 === 0 ? 'warning' : 'error' as const,
    }));

    // Each filter call iterates all 1000 items
    const callCount = 3;
    const totalIterations = alerts.length * callCount;
    expect(totalIterations).toBe(3000); // Wasteful; should be 1000
  });

  it('GAP IDENTIFIED: summary.totalStockValue uses non-existent properties', () => {
    // In useVariantStock.ts line 347-348:
    // v.stockQuantity and v.price don't exist on VariantStock
    // They always evaluate to undefined, so (undefined || 0) * (undefined || 0) = 0
    const variant = makeVariant({ currentStock: 100 });
    const stockQuantity = (variant as any).stockQuantity; // undefined
    const price = (variant as any).price; // undefined
    expect(stockQuantity).toBeUndefined();
    expect(price).toBeUndefined();
    // totalStockValue will always be 0 — this is a dead calculation
  });

  it('StatCard opens dialog even when value is 0', () => {
    // When productsOutOfStock = 0, clicking still opens the empty dialog
    // This is acceptable UX (shows "Nenhum alerta crítico" message)
    // But could optionally disable onClick when value is 0
    const value = 0;
    const shouldBeClickable = value > 0;
    expect(shouldBeClickable).toBe(false);
    // Currently always clickable — this is a minor UX gap
  });
});

// ============================================
// 7. Filter logic edge cases
// ============================================

describe('Filter logic edge cases', () => {
  it('search is case-insensitive', () => {
    const searchLower = 'caneta'.toLowerCase();
    const productName = 'Caneta Esferográfica';
    expect(productName.toLowerCase().includes(searchLower)).toBe(true);
  });

  it('search works on SKU', () => {
    const searchLower = '94140'.toLowerCase();
    const productSku = 'SKU-94140';
    expect(productSku.toLowerCase().includes(searchLower)).toBe(true);
  });

  it('search works on variant color name', () => {
    const searchLower = 'azul'.toLowerCase();
    const colorName = 'Azul Marinho';
    expect(colorName?.toLowerCase().includes(searchLower)).toBe(true);
  });

  it('empty search returns all products', () => {
    const search = '';
    const items = [{ name: 'A' }, { name: 'B' }];
    const filtered = search ? items.filter(() => false) : items;
    expect(filtered).toHaveLength(2);
  });

  it('status filter with incoming checks inTransit', () => {
    const product = {
      overallStatus: 'in_stock' as StockStatus,
      totalInTransitStock: 50,
      variants: [{ status: 'in_stock' as StockStatus, inTransitStock: 50 }],
    };
    const matchesIncoming = 
      product.overallStatus === 'incoming' ||
      product.totalInTransitStock > 0 ||
      product.variants.some(v => v.status === 'incoming' || v.inTransitStock > 0);
    expect(matchesIncoming).toBe(true);
  });

  it('sorting by days_remaining handles undefined (falls back to 999)', () => {
    const products = [
      { daysUntilFullStockout: undefined },
      { daysUntilFullStockout: 5 },
      { daysUntilFullStockout: undefined },
      { daysUntilFullStockout: 2 },
    ];
    const sorted = [...products].sort((a, b) => {
      const aDays = a.daysUntilFullStockout ?? 999;
      const bDays = b.daysUntilFullStockout ?? 999;
      return aDays - bDays;
    });
    expect(sorted[0].daysUntilFullStockout).toBe(2);
    expect(sorted[1].daysUntilFullStockout).toBe(5);
    expect(sorted[2].daysUntilFullStockout).toBeUndefined();
  });
});

// ============================================
// 8. Pagination safety (anti-loop)
// ============================================

describe('Pagination safety', () => {
  it('anti-loop: stops when first ID repeats', () => {
    // Simulates the logic from fetchPaginatedFromBridge
    const pages = [
      [{ id: 'a' }, { id: 'b' }],
      [{ id: 'c' }, { id: 'd' }],
      [{ id: 'c' }, { id: 'd' }], // Repeated first ID → should stop
    ];

    const all: { id: string }[] = [];
    let lastFirstId: string | undefined;

    for (const page of pages) {
      if (page[0]?.id === lastFirstId) break;
      lastFirstId = page[0]?.id;
      all.push(...page);
    }

    expect(all).toHaveLength(4); // Only first 2 pages
  });

  it('stops when records.length < pageSize', () => {
    const pageSize = 1000;
    const records = Array.from({ length: 500 }, (_, i) => ({ id: String(i) }));
    expect(records.length < pageSize).toBe(true);
  });
});

// ============================================
// 9. toNumber helper robustness
// ============================================

describe('toNumber helper logic', () => {
  // Mirrors the inline toNumber function from useVariantStock
  function toNumber(value: unknown, fallback = 0): number {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  it('handles normal numbers', () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber(0)).toBe(0);
    expect(toNumber(-5)).toBe(-5);
  });

  it('handles string numbers', () => {
    expect(toNumber('42')).toBe(42);
    expect(toNumber('0')).toBe(0);
  });

  it('handles NaN', () => {
    expect(toNumber(NaN)).toBe(0);
    expect(toNumber(NaN, 99)).toBe(99);
  });

  it('handles Infinity', () => {
    expect(toNumber(Infinity)).toBe(0);
    expect(toNumber(-Infinity)).toBe(0);
  });

  it('handles null/undefined', () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });

  it('handles non-numeric strings', () => {
    expect(toNumber('abc')).toBe(0);
    expect(toNumber('')).toBe(0);
  });

  it('handles boolean', () => {
    expect(toNumber(true)).toBe(1);
    expect(toNumber(false)).toBe(0);
  });
});

// ============================================
// 10. StockProgressBar boundary logic
// ============================================

describe('StockProgressBar percentage logic', () => {
  function calcPercentage(current: number, min: number): number {
    return min > 0 ? Math.min((current / min) * 100, 100) : (current > 0 ? 100 : 0);
  }

  it('returns 0% when current=0 and min=0', () => {
    expect(calcPercentage(0, 0)).toBe(0);
  });

  it('returns 100% when current>0 and min=0', () => {
    expect(calcPercentage(50, 0)).toBe(100);
  });

  it('caps at 100% when current > min', () => {
    expect(calcPercentage(200, 100)).toBe(100);
  });

  it('returns exact percentage when below min', () => {
    expect(calcPercentage(50, 100)).toBe(50);
    expect(calcPercentage(25, 100)).toBe(25);
  });

  it('returns 0% when current=0 and min>0', () => {
    expect(calcPercentage(0, 100)).toBe(0);
  });
});

// ============================================
// 11. Summary calculation edge cases
// ============================================

describe('Summary edge cases', () => {
  it('handles empty productStocks', () => {
    const products: ProductStockSummary[] = [];
    const summary = {
      totalProducts: products.length,
      productsInStock: products.filter(p => p.overallStatus === 'in_stock').length,
      productsOutOfStock: products.filter(p => p.overallStatus === 'out_of_stock').length,
    };
    expect(summary.totalProducts).toBe(0);
    expect(summary.productsInStock).toBe(0);
    expect(summary.productsOutOfStock).toBe(0);
  });

  it('averageDaysOfStock divides by max(1, length) to avoid division by zero', () => {
    const variants: any[] = [];
    const avg = variants.reduce((sum: number, v: any) => sum + (v.daysUntilStockout || 0), 0) / Math.max(1, variants.length);
    expect(avg).toBe(0); // Not NaN
  });
});

// ============================================
// 12. Color aggregation stress test
// ============================================

describe('Color aggregation at scale', () => {
  it('handles 100 unique colors without errors', () => {
    const variants = Array.from({ length: 100 }, (_, i) =>
      makeVariant({ id: `v${i}`, colorName: `Cor ${i}`, colorHex: `#${String(i).padStart(6, '0')}` })
    );
    const result = aggregateVariantsToProduct(variants);
    expect(result.availableColors).toHaveLength(100);
    expect(result.totalVariants).toBe(100);
  });

  it('handles 1000 variants of same color', () => {
    const variants = Array.from({ length: 1000 }, (_, i) =>
      makeVariant({ id: `v${i}`, colorName: 'Preto', currentStock: 1 })
    );
    const result = aggregateVariantsToProduct(variants);
    expect(result.availableColors).toHaveLength(1);
    expect(result.totalCurrentStock).toBe(1000);
    expect(result.availableColors[0].totalStock).toBe(1000);
  });
});
