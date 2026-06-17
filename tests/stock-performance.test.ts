/**
 * Stock Module — Comprehensive Performance & Stress Test Suite
 * Tests: data processing, filtering, alerts, aggregation, memory, edge cases
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateStockStatus,
  calculateDaysUntilStockout,
  calculateAvailableStock,
  aggregateVariantsToProduct,
  defaultStockFilters,
  type VariantStock,
  type ProductStockSummary,
  type StockFilters,
  type StockStatus,
} from '@/types/stock';
import { generateStockAlerts } from '@/hooks/stock/stockAlerts';
import { toNumber } from '@/hooks/stock/stockFetcher';

// ============================================
// HELPERS — Generate fake data at scale
// ============================================

function makeVariant(overrides: Partial<VariantStock> = {}): VariantStock {
  const id = overrides.id || crypto.randomUUID();
  return {
    id,
    productId: 'prod-1',
    variantId: id,
    variantSku: `SKU-${id.slice(0, 6)}`,
    colorName: 'Azul',
    colorHex: '#0000FF',
    currentStock: 100,
    minStock: 10,
    reservedStock: 0,
    inTransitStock: 0,
    availableStock: 100,
    status: 'in_stock',
    daysUntilStockout: 50,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeProduct(overrides: Partial<ProductStockSummary> = {}, variantCount = 5): ProductStockSummary {
  const variants = Array.from({ length: variantCount }, (_, i) =>
    makeVariant({
      id: `v-${overrides.productId || 'p'}-${i}`,
      productId: overrides.productId || 'prod-1',
      colorName: ['Azul', 'Vermelho', 'Verde', 'Preto', 'Branco'][i % 5],
      colorHex: ['#0000FF', '#FF0000', '#00FF00', '#000000', '#FFFFFF'][i % 5],
      currentStock: Math.floor(Math.random() * 200),
      minStock: 10,
    })
  );
  const aggregated = aggregateVariantsToProduct(variants);
  return {
    productId: overrides.productId || 'prod-1',
    productName: overrides.productName || 'Produto Teste',
    productSku: overrides.productSku || 'SKU-001',
    ...aggregated,
    ...overrides,
    variants: overrides.variants || aggregated.variants,
    availableColors: overrides.availableColors || aggregated.availableColors,
  } as ProductStockSummary;
}

function generateLargeDataset(productCount: number, variantsPerProduct: number) {
  return Array.from({ length: productCount }, (_, i) =>
    makeProduct({ productId: `prod-${i}`, productName: `Produto ${i}`, productSku: `SKU-${i}` }, variantsPerProduct)
  );
}

// ============================================
// 1. calculateStockStatus — Unit Tests
// ============================================

describe('calculateStockStatus', () => {
  it('returns out_of_stock when current=0', () => {
    expect(calculateStockStatus(0, 10)).toBe('out_of_stock');
  });
  it('returns incoming when current=0 but inTransit>0', () => {
    expect(calculateStockStatus(0, 10, undefined, 50)).toBe('incoming');
  });
  // NOTA: a régua baseada em `min` (low_stock/critical) foi descontinuada.
  // Agora só geram low_stock/critical via camada preditiva (rupture-risk).
  it('does NOT return critical or low_stock from min (deprecated)', () => {
    expect(calculateStockStatus(2, 10)).toBe('in_stock');
    expect(calculateStockStatus(1, 100)).toBe('in_stock');
    expect(calculateStockStatus(5, 10)).toBe('in_stock');
    expect(calculateStockStatus(10, 10)).toBe('in_stock');
    expect(calculateStockStatus(25, 100)).toBe('in_stock');
  });
  it('returns in_stock when current>0 and no max', () => {
    expect(calculateStockStatus(100, 10)).toBe('in_stock');
  });
  it('returns overstocked when current>max*1.5', () => {
    expect(calculateStockStatus(200, 10, 100)).toBe('overstocked');
  });
  it('handles edge: min=0', () => {
    expect(calculateStockStatus(0, 0)).toBe('out_of_stock');
    expect(calculateStockStatus(1, 0)).toBe('in_stock');
  });
  it('handles negative values gracefully', () => {
    expect(calculateStockStatus(-5, 10)).toBe('out_of_stock');
  });
  it('handles very large numbers', () => {
    expect(calculateStockStatus(999999, 10)).toBe('in_stock');
    expect(calculateStockStatus(999999, 10, 100)).toBe('overstocked');
  });
});

// ============================================
// 2. calculateDaysUntilStockout
// ============================================

describe('calculateDaysUntilStockout', () => {
  it('returns undefined when stock<=0', () => {
    expect(calculateDaysUntilStockout(0)).toBeUndefined();
    expect(calculateDaysUntilStockout(-10)).toBeUndefined();
  });
  it('returns undefined when avgDailySales<=0', () => {
    expect(calculateDaysUntilStockout(100, 0)).toBeUndefined();
    expect(calculateDaysUntilStockout(100, -5)).toBeUndefined();
  });
  it('calculates correctly with default avgDailySales=2', () => {
    expect(calculateDaysUntilStockout(100)).toBe(50);
    expect(calculateDaysUntilStockout(1)).toBe(0);
  });
  it('calculates correctly with custom avgDailySales', () => {
    expect(calculateDaysUntilStockout(100, 10)).toBe(10);
    expect(calculateDaysUntilStockout(7, 3)).toBe(2);
  });
  it('handles very large stock', () => {
    const result = calculateDaysUntilStockout(1_000_000, 1);
    expect(result).toBe(1_000_000);
  });
});

// ============================================
// 3. calculateAvailableStock
// ============================================

describe('calculateAvailableStock', () => {
  it('returns stock minus reserved', () => {
    expect(calculateAvailableStock(100, 30)).toBe(70);
  });
  it('returns 0 when reserved >= current', () => {
    expect(calculateAvailableStock(10, 20)).toBe(0);
    expect(calculateAvailableStock(10, 10)).toBe(0);
  });
  it('returns stock when no reserved', () => {
    expect(calculateAvailableStock(100)).toBe(100);
    expect(calculateAvailableStock(100, 0)).toBe(100);
  });
  it('handles zero stock', () => {
    expect(calculateAvailableStock(0, 0)).toBe(0);
  });
});

// ============================================
// 4. toNumber helper
// ============================================

describe('toNumber', () => {
  it('passes through numbers', () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber(0)).toBe(0);
    expect(toNumber(-5)).toBe(-5);
  });
  it('converts strings', () => {
    expect(toNumber('123')).toBe(123);
    expect(toNumber('0')).toBe(0);
  });
  it('returns fallback for NaN', () => {
    expect(toNumber('abc')).toBe(0);
    expect(toNumber('abc', 99)).toBe(99);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber(null)).toBe(0);
  });
  it('handles Infinity', () => {
    expect(toNumber(Infinity)).toBe(0);
    expect(toNumber(-Infinity)).toBe(0);
  });
  it('handles booleans', () => {
    expect(toNumber(true)).toBe(1);
    expect(toNumber(false)).toBe(0);
  });
});

// ============================================
// 5. aggregateVariantsToProduct — Logic Tests
// ============================================

describe('aggregateVariantsToProduct', () => {
  it('aggregates totals correctly', () => {
    const variants = [
      makeVariant({ currentStock: 50, minStock: 10, reservedStock: 5, inTransitStock: 20, availableStock: 45 }),
      makeVariant({ currentStock: 30, minStock: 10, reservedStock: 0, inTransitStock: 0, availableStock: 30 }),
    ];
    const result = aggregateVariantsToProduct(variants);
    expect(result.totalCurrentStock).toBe(80);
    expect(result.totalMinStock).toBe(20);
    expect(result.totalReservedStock).toBe(5);
    expect(result.totalInTransitStock).toBe(20);
    expect(result.totalAvailableStock).toBe(75);
    expect(result.totalVariants).toBe(2);
  });

  it('groups colors correctly', () => {
    const variants = [
      makeVariant({ colorName: 'Azul', colorHex: '#00F', currentStock: 50 }),
      makeVariant({ colorName: 'Azul', colorHex: '#00F', currentStock: 30 }),
      makeVariant({ colorName: 'Vermelho', colorHex: '#F00', currentStock: 20 }),
    ];
    const result = aggregateVariantsToProduct(variants);
    expect(result.availableColors).toHaveLength(2);
    const azul = result.availableColors.find(c => c.colorName === 'Azul');
    expect(azul?.totalStock).toBe(80);
  });

  it('determines overall status: all out_of_stock', () => {
    const variants = [
      makeVariant({ currentStock: 0, status: 'out_of_stock', availableStock: 0 }),
      makeVariant({ currentStock: 0, status: 'out_of_stock', availableStock: 0 }),
    ];
    const result = aggregateVariantsToProduct(variants);
    expect(result.overallStatus).toBe('out_of_stock');
  });

  it('determines overall status: mixed critical', () => {
    const variants = [
      makeVariant({ currentStock: 100, status: 'in_stock' }),
      makeVariant({ currentStock: 0, status: 'out_of_stock', availableStock: 0 }),
    ];
    const result = aggregateVariantsToProduct(variants);
    expect(result.overallStatus).toBe('critical');
  });

  it('determines overall status: incoming', () => {
    const variants = [
      makeVariant({ currentStock: 0, status: 'incoming', inTransitStock: 50, availableStock: 0 }),
    ];
    const result = aggregateVariantsToProduct(variants);
    expect(result.overallStatus).toBe('incoming');
  });

  it('handles empty variants', () => {
    const result = aggregateVariantsToProduct([]);
    expect(result.totalVariants).toBe(0);
    expect(result.totalCurrentStock).toBe(0);
    expect(result.overallStatus).toBe('in_stock');
  });

  it('handles single variant', () => {
    const result = aggregateVariantsToProduct([makeVariant({ currentStock: 5, minStock: 10, status: 'low_stock' })]);
    expect(result.totalVariants).toBe(1);
    expect(result.overallStatus).toBe('low_stock');
  });
});

// ============================================
// 6. generateStockAlerts — Alert Generation
// ============================================

describe('generateStockAlerts', () => {
  it('generates out_of_stock alerts', () => {
    const products = [makeProduct({
      variants: [makeVariant({ currentStock: 0, status: 'out_of_stock', availableStock: 0 })],
    })];
    const alerts = generateStockAlerts(products);
    expect(alerts.some(a => a.type === 'out_of_stock')).toBe(true);
    expect(alerts[0].severity).toBe('error');
  });

  it('generates critical alerts', () => {
    const products = [makeProduct({
      variants: [makeVariant({ currentStock: 2, minStock: 100, status: 'critical' })],
    })];
    const alerts = generateStockAlerts(products);
    expect(alerts.some(a => a.type === 'critical')).toBe(true);
  });

  it('generates low_stock alerts', () => {
    const products = [makeProduct({
      variants: [makeVariant({ currentStock: 8, minStock: 10, status: 'low_stock' })],
    })];
    const alerts = generateStockAlerts(products);
    expect(alerts.some(a => a.type === 'low_stock')).toBe(true);
    expect(alerts[0].severity).toBe('warning');
  });

  it('generates stockout_predicted alerts', () => {
    const products = [makeProduct({
      variants: [makeVariant({ currentStock: 10, status: 'low_stock', daysUntilStockout: 5 })],
    })];
    const alerts = generateStockAlerts(products);
    expect(alerts.some(a => a.type === 'stockout_predicted')).toBe(true);
  });

  it('does NOT generate stockout_predicted for out_of_stock items', () => {
    const products = [makeProduct({
      variants: [makeVariant({ currentStock: 0, status: 'out_of_stock', daysUntilStockout: 0 })],
    })];
    const alerts = generateStockAlerts(products);
    expect(alerts.some(a => a.type === 'stockout_predicted')).toBe(false);
  });

  it('sorts by severity (error first)', () => {
    const products = [makeProduct({
      variants: [
        makeVariant({ id: 'v1', currentStock: 8, minStock: 10, status: 'low_stock' }),
        makeVariant({ id: 'v2', currentStock: 0, status: 'out_of_stock', availableStock: 0 }),
      ],
    })];
    const alerts = generateStockAlerts(products);
    expect(alerts[0].severity).toBe('error');
  });

  it('generates no alerts for healthy products', () => {
    const products = [makeProduct({
      variants: [makeVariant({ currentStock: 100, minStock: 10, status: 'in_stock', daysUntilStockout: 50 })],
    })];
    const alerts = generateStockAlerts(products);
    expect(alerts).toHaveLength(0);
  });
});

// ============================================
// 7. FILTERING LOGIC (simulated from useVariantStock)
// ============================================

function applyFilters(products: ProductStockSummary[], filters: StockFilters, alerts: { productId: string }[] = []) {
  let items = [...products];

  if (filters.status !== 'all') {
    items = items.filter(p => {
      if (p.overallStatus === filters.status) return true;
      if (filters.status === 'low_stock' && p.overallStatus === 'critical') return true;
      if (filters.status === 'incoming') {
        return p.totalInTransitStock > 0 || p.variants.some(v => v.status === 'incoming' || v.inTransitStock > 0);
      }
      return p.variants.some(v => v.status === filters.status);
    });
  }

  if (filters.search) {
    const s = filters.search.toLowerCase();
    items = items.filter(p =>
      p.productName.toLowerCase().includes(s) ||
      p.productSku.toLowerCase().includes(s) ||
      p.variants.some(v => v.colorName?.toLowerCase().includes(s) || v.variantSku.toLowerCase().includes(s))
    );
  }

  if (filters.categoryId) items = items.filter(p => p.categoryName === filters.categoryId);
  if (filters.supplierId) items = items.filter(p => p.supplierName === filters.supplierId);
  if (filters.colorName) items = items.filter(p => p.variants.some(v => v.colorName === filters.colorName));
  if (filters.minQuantityNeeded && filters.minQuantityNeeded > 0) {
    items = items.filter(p => p.totalAvailableStock >= filters.minQuantityNeeded!);
  }
  if (filters.showOnlyWithAlerts) {
    const ids = new Set(alerts.map(a => a.productId));
    items = items.filter(p => ids.has(p.productId));
  }

  return items;
}

describe('Filter Logic', () => {
  const dataset = generateLargeDataset(100, 5);

  it('default filters return all products', () => {
    expect(applyFilters(dataset, defaultStockFilters)).toHaveLength(100);
  });

  it('search filters by name', () => {
    const result = applyFilters(dataset, { ...defaultStockFilters, search: 'Produto 5' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(p => p.productName.toLowerCase().includes('produto 5'))).toBe(true);
  });

  it('search filters by SKU', () => {
    const result = applyFilters(dataset, { ...defaultStockFilters, search: 'SKU-42' });
    expect(result.length).toBeGreaterThan(0);
  });

  it('status filter: out_of_stock', () => {
    const products = [
      makeProduct({ productId: 'p1', variants: [makeVariant({ status: 'out_of_stock', currentStock: 0, availableStock: 0 })] }),
      makeProduct({ productId: 'p2', variants: [makeVariant({ status: 'in_stock', currentStock: 100 })] }),
    ];
    const result = applyFilters(products, { ...defaultStockFilters, status: 'out_of_stock' });
    expect(result).toHaveLength(1);
    expect(result[0].productId).toBe('p1');
  });

  it('low_stock filter includes critical', () => {
    const products = [
      makeProduct({ productId: 'p1', overallStatus: 'low_stock' }),
      makeProduct({ productId: 'p2', overallStatus: 'critical' }),
      makeProduct({ productId: 'p3', overallStatus: 'in_stock' }),
    ];
    const result = applyFilters(products, { ...defaultStockFilters, status: 'low_stock' });
    expect(result).toHaveLength(2);
  });

  it('colorName filter works', () => {
    const result = applyFilters(dataset, { ...defaultStockFilters, colorName: 'Azul' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(p => p.variants.some(v => v.colorName === 'Azul'))).toBe(true);
  });

  it('minQuantityNeeded filter works', () => {
    const result = applyFilters(dataset, { ...defaultStockFilters, minQuantityNeeded: 500 });
    expect(result.every(p => p.totalAvailableStock >= 500)).toBe(true);
  });

  it('showOnlyWithAlerts filter works', () => {
    const alerts = [{ productId: 'prod-0' }, { productId: 'prod-5' }];
    const result = applyFilters(dataset, { ...defaultStockFilters, showOnlyWithAlerts: true }, alerts);
    expect(result).toHaveLength(2);
  });

  it('combined filters narrow results', () => {
    const result = applyFilters(dataset, {
      ...defaultStockFilters,
      search: 'Produto',
      colorName: 'Azul',
      minQuantityNeeded: 50,
    });
    expect(result.length).toBeLessThanOrEqual(dataset.length);
  });
});

// ============================================
// 8. PERFORMANCE — Large Dataset Processing
// ============================================

describe('Performance — Large Dataset Stress', () => {
  it('aggregates 1,000 products x 10 variants in <500ms', () => {
    const start = performance.now();
    const products = generateLargeDataset(1000, 10);
    const elapsed = performance.now() - start;
    expect(products).toHaveLength(1000);
    expect(elapsed).toBeLessThan(500);
  });

  it('aggregates 5,000 products x 5 variants in <2s', () => {
    const start = performance.now();
    const products = generateLargeDataset(5000, 5);
    const elapsed = performance.now() - start;
    expect(products).toHaveLength(5000);
    expect(elapsed).toBeLessThan(2000);
  });

  it('generates alerts for 5,000 products in <500ms', () => {
    const products = generateLargeDataset(5000, 5);
    const start = performance.now();
    const alerts = generateStockAlerts(products);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
    expect(Array.isArray(alerts)).toBe(true);
  });

  it('filters 5,000 products by status in <100ms', () => {
    const products = generateLargeDataset(5000, 5);
    const start = performance.now();
    applyFilters(products, { ...defaultStockFilters, status: 'out_of_stock' });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it('filters 5,000 products by search in <200ms', () => {
    const products = generateLargeDataset(5000, 5);
    const start = performance.now();
    applyFilters(products, { ...defaultStockFilters, search: 'Produto 123' });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });

  it('combined filters on 5,000 products in <200ms', () => {
    const products = generateLargeDataset(5000, 5);
    const start = performance.now();
    applyFilters(products, {
      ...defaultStockFilters,
      status: 'low_stock',
      search: 'Produto',
      colorName: 'Azul',
      minQuantityNeeded: 100,
    });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });

  it('aggregateVariantsToProduct handles 50 variants in <5ms', () => {
    const variants = Array.from({ length: 50 }, (_, i) =>
      makeVariant({ id: `v-${i}`, colorName: `Cor ${i % 10}`, currentStock: i * 10 })
    );
    const start = performance.now();
    const result = aggregateVariantsToProduct(variants);
    const elapsed = performance.now() - start;
    expect(result.totalVariants).toBe(50);
    expect(elapsed).toBeLessThan(5);
  });
});

// ============================================
// 9. EDGE CASES
// ============================================

describe('Edge Cases', () => {
  it('handles products with no variants', () => {
    const result = aggregateVariantsToProduct([]);
    expect(result.totalVariants).toBe(0);
    expect(result.overallStatus).toBe('in_stock');
  });

  it('handles variant with all zeros', () => {
    const v = makeVariant({ currentStock: 0, minStock: 0, reservedStock: 0, inTransitStock: 0, availableStock: 0, status: 'out_of_stock' });
    const result = aggregateVariantsToProduct([v]);
    expect(result.totalCurrentStock).toBe(0);
    expect(result.overallStatus).toBe('out_of_stock');
  });

  it('handles variant with null-like colorName', () => {
    const v = makeVariant({ colorName: undefined });
    const result = aggregateVariantsToProduct([v]);
    expect(result.availableColors).toHaveLength(1);
    expect(result.availableColors[0].colorName).toBe('Sem cor');
  });

  it('handles search with special characters', () => {
    const products = [makeProduct({ productName: 'Caneta (azul) - 500ml' })];
    const result = applyFilters(products, { ...defaultStockFilters, search: '(azul)' });
    expect(result).toHaveLength(1);
  });

  it('handles empty search string', () => {
    const products = generateLargeDataset(10, 3);
    const result = applyFilters(products, { ...defaultStockFilters, search: '' });
    expect(result).toHaveLength(10);
  });

  it('handles case-insensitive search', () => {
    const products = [makeProduct({ productName: 'CANETA PREMIUM' })];
    const result = applyFilters(products, { ...defaultStockFilters, search: 'caneta premium' });
    expect(result).toHaveLength(1);
  });

  it('toNumber handles edge values', () => {
    expect(toNumber(NaN)).toBe(0);
    expect(toNumber('')).toBe(0);
    expect(toNumber('  ')).toBe(0);
    expect(toNumber('1e3')).toBe(1000);
  });
});

// ============================================
// 10. SUMMARY CALCULATION PERFORMANCE
// ============================================

describe('Summary Calculation', () => {
  it('computes summary for 5,000 products in <200ms', () => {
    const products = generateLargeDataset(5000, 5);
    const start = performance.now();
    
    const allVariants = products.flatMap(p => p.variants);
    const summary = {
      totalProducts: products.length,
      totalVariants: allVariants.length,
      totalColors: new Set(allVariants.map(v => v.colorName).filter(Boolean)).size,
      productsInStock: products.filter(p => p.overallStatus === 'in_stock').length,
      productsLowStock: products.filter(p => p.overallStatus === 'low_stock').length,
      productsCritical: products.filter(p => p.overallStatus === 'critical').length,
      productsOutOfStock: products.filter(p => p.overallStatus === 'out_of_stock').length,
    };
    
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
    expect(summary.totalProducts).toBe(5000);
    expect(summary.totalVariants).toBe(25000);
  });

  it('extracts unique categories/suppliers in <100ms for 5,000 products', () => {
    const products = generateLargeDataset(5000, 5).map((p, i) => ({
      ...p,
      categoryName: `Cat-${i % 50}`,
      supplierName: `Sup-${i % 20}`,
    }));
    
    const start = performance.now();
    const catMap = new Map<string, number>();
    products.forEach(p => {
      const cat = p.categoryName || 'Sem categoria';
      catMap.set(cat, (catMap.get(cat) || 0) + 1);
    });
    const supMap = new Map<string, number>();
    products.forEach(p => {
      const sup = p.supplierName || 'Sem fornecedor';
      supMap.set(sup, (supMap.get(sup) || 0) + 1);
    });
    const elapsed = performance.now() - start;
    
    expect(catMap.size).toBe(50);
    expect(supMap.size).toBe(20);
    expect(elapsed).toBeLessThan(100);
  });
});

// ============================================
// 11. ALERT VOLUME STRESS
// ============================================

describe('Alert Volume Stress', () => {
  it('handles 10,000 products generating thousands of alerts', () => {
    // All variants critical → 10k products × 3 variants = 30k alerts potential
    const products = Array.from({ length: 10000 }, (_, i) =>
      makeProduct({
        productId: `p-${i}`,
        variants: [
          makeVariant({ id: `v-${i}-0`, currentStock: 0, status: 'out_of_stock', availableStock: 0, daysUntilStockout: undefined }),
          makeVariant({ id: `v-${i}-1`, currentStock: 1, minStock: 100, status: 'critical', daysUntilStockout: 3 }),
          makeVariant({ id: `v-${i}-2`, currentStock: 8, minStock: 10, status: 'low_stock', daysUntilStockout: 4 }),
        ],
      })
    );
    const start = performance.now();
    const alerts = generateStockAlerts(products);
    const elapsed = performance.now() - start;
    
    // Each product: 1 out_of_stock + 1 critical + 1 low_stock + 2 stockout_predicted = 5 alerts
    expect(alerts.length).toBe(50000);
    expect(elapsed).toBeLessThan(2000);
  });
});

// ============================================
// 12. DEFAULTSTOCKFILTERS INTEGRITY
// ============================================

describe('defaultStockFilters', () => {
  it('has correct defaults', () => {
    expect(defaultStockFilters.status).toBe('all');
    expect(defaultStockFilters.search).toBe('');
    expect(defaultStockFilters.sortBy).toBe('stock_quantity');
    expect(defaultStockFilters.sortDirection).toBe('asc');
    expect(defaultStockFilters.groupBy).toBe('product');
    expect(defaultStockFilters.showOnlyWithVariants).toBe(false);
    expect(defaultStockFilters.showOnlyWithAlerts).toBe(false);
  });

  it('is a plain object (not frozen)', () => {
    const copy = { ...defaultStockFilters, status: 'low_stock' as const };
    expect(copy.status).toBe('low_stock');
  });
});

// ============================================
// 13. COLOR AGGREGATION ACCURACY
// ============================================

describe('Color Aggregation Accuracy', () => {
  it('aggregates same color across variants', () => {
    const variants = [
      makeVariant({ colorName: 'Azul', currentStock: 50, availableStock: 50 }),
      makeVariant({ colorName: 'Azul', currentStock: 30, availableStock: 30 }),
      makeVariant({ colorName: 'Vermelho', currentStock: 20, availableStock: 20 }),
    ];
    const result = aggregateVariantsToProduct(variants);
    expect(result.availableColors).toHaveLength(2);
    
    const azul = result.availableColors.find(c => c.colorName === 'Azul')!;
    expect(azul.totalStock).toBe(80);
    expect(azul.availableStock).toBe(80);
    expect(azul.variants).toHaveLength(2);
    
    const verm = result.availableColors.find(c => c.colorName === 'Vermelho')!;
    expect(verm.totalStock).toBe(20);
    expect(verm.variants).toHaveLength(1);
  });

  it('handles 100 unique colors', () => {
    const variants = Array.from({ length: 100 }, (_, i) =>
      makeVariant({ colorName: `Cor-${i}`, currentStock: i + 1 })
    );
    const result = aggregateVariantsToProduct(variants);
    expect(result.availableColors).toHaveLength(100);
  });
});

// ============================================
// 14. SORT LOGIC
// ============================================

describe('Sort Logic', () => {
  it('sorts by stock_quantity ascending', () => {
    const products = [
      makeProduct({ productId: 'a', productName: 'A', variants: [makeVariant({ currentStock: 100 })] }),
      makeProduct({ productId: 'b', productName: 'B', variants: [makeVariant({ currentStock: 10 })] }),
      makeProduct({ productId: 'c', productName: 'C', variants: [makeVariant({ currentStock: 50 })] }),
    ];
    const sorted = [...products].sort((a, b) => a.totalCurrentStock - b.totalCurrentStock);
    expect(sorted[0].totalCurrentStock).toBeLessThanOrEqual(sorted[1].totalCurrentStock);
  });

  it('sorts by name ascending', () => {
    const products = [
      makeProduct({ productName: 'Caneta' }),
      makeProduct({ productName: 'Agenda' }),
      makeProduct({ productName: 'Bolsa' }),
    ];
    const sorted = [...products].sort((a, b) => a.productName.localeCompare(b.productName));
    expect(sorted[0].productName).toBe('Agenda');
    expect(sorted[1].productName).toBe('Bolsa');
    expect(sorted[2].productName).toBe('Caneta');
  });
});

// ============================================
// 15. MEMORY / GC PRESSURE
// ============================================

describe('Memory Pressure', () => {
  it('processes and discards 10,000 products without OOM', () => {
    for (let batch = 0; batch < 5; batch++) {
      const products = generateLargeDataset(2000, 5);
      const alerts = generateStockAlerts(products);
      const filtered = applyFilters(products, { ...defaultStockFilters, status: 'out_of_stock' });
      expect(products.length).toBe(2000);
    }
    // If we reach here, no OOM
    expect(true).toBe(true);
  });
});
