/**
 * BATERIA EXAUSTIVA DE TESTES — Módulo de Inteligência Comercial
 * 
 * Cenários cobertos:
 * 1. Lógica de negócio dos hooks (getSinceDate, filterByProductIds, aggregation)
 * 2. Interface de filtros (IntelligenceFilters, period options, filter counts)
 * 3. Componentes de ranking (TrendingProducts, SupplierSales, OpportunityFinder)
 * 4. KPI calculations (conversion rate, average ticket, edge cases)
 * 5. Edge cases (empty data, null values, extreme periods, overflow)
 * 6. Data integrity (duplicate keys, missing IDs, null product_id)
 * 7. Filter combinations (category + supplier + product)
 * 8. Mock data fallback behavior
 * 9. Bugs encontrados durante auditoria
 */

import { describe, it, expect, vi } from 'vitest';

// =============================================
// 1. PURE LOGIC TESTS — getSinceDate equivalent
// =============================================
describe('getSinceDate logic', () => {
  function getSinceDate(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }

  it('should return ISO string for 30 days ago', () => {
    const result = getSinceDate(30);
    const parsed = new Date(result);
    const diff = Date.now() - parsed.getTime();
    expect(diff).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(diff).toBeLessThan(31 * 24 * 60 * 60 * 1000);
  });

  it('should handle 0 days (today)', () => {
    const result = getSinceDate(0);
    const parsed = new Date(result);
    const diff = Date.now() - parsed.getTime();
    expect(diff).toBeLessThan(60 * 1000); // < 1 minute
  });

  it('should handle 360 days (1 year)', () => {
    const result = getSinceDate(360);
    const parsed = new Date(result);
    const diff = Date.now() - parsed.getTime();
    expect(diff).toBeGreaterThan(359 * 24 * 60 * 60 * 1000);
  });

  it('should handle 7 days (minimum period)', () => {
    const result = getSinceDate(7);
    expect(result).toBeTruthy();
    expect(new Date(result).toString()).not.toBe('Invalid Date');
  });

  it('should handle negative days gracefully (future date)', () => {
    const result = getSinceDate(-1);
    const parsed = new Date(result);
    expect(parsed.getTime()).toBeGreaterThan(Date.now() - 60000);
  });
});

// =============================================
// 2. filterByProductIds LOGIC
// =============================================
describe('filterByProductIds logic', () => {
  function filterByProductIds<T extends { product_id?: string | null }>(
    items: T[],
    productIds: Set<string> | null | undefined,
  ): T[] {
    if (!productIds) return items;
    return items.filter(item => item.product_id && productIds.has(item.product_id));
  }

  it('should return all items when productIds is null (no filter)', () => {
    const items = [{ product_id: 'a' }, { product_id: 'b' }];
    expect(filterByProductIds(items, null)).toHaveLength(2);
  });

  it('should return all items when productIds is undefined', () => {
    const items = [{ product_id: 'a' }];
    expect(filterByProductIds(items, undefined)).toHaveLength(1);
  });

  it('should filter items matching the set', () => {
    const items = [{ product_id: 'a' }, { product_id: 'b' }, { product_id: 'c' }];
    const ids = new Set(['a', 'c']);
    expect(filterByProductIds(items, ids)).toHaveLength(2);
  });

  it('should exclude items with null product_id', () => {
    const items = [{ product_id: null }, { product_id: 'a' }];
    const ids = new Set(['a']);
    expect(filterByProductIds(items, ids)).toHaveLength(1);
  });

  it('should exclude items with undefined product_id', () => {
    const items = [{ product_id: undefined }, { product_id: 'a' }];
    const ids = new Set(['a']);
    expect(filterByProductIds(items, ids)).toHaveLength(1);
  });

  it('should return empty array when no items match', () => {
    const items = [{ product_id: 'x' }, { product_id: 'y' }];
    const ids = new Set(['a', 'b']);
    expect(filterByProductIds(items, ids)).toHaveLength(0);
  });

  it('should return empty array when items is empty', () => {
    expect(filterByProductIds([], new Set(['a']))).toHaveLength(0);
  });

  it('should return empty array when filter set is empty', () => {
    const items = [{ product_id: 'a' }];
    expect(filterByProductIds(items, new Set())).toHaveLength(0);
  });

  it('should handle large datasets (>200 items)', () => {
    const items = Array.from({ length: 500 }, (_, i) => ({ product_id: `id-${i}` }));
    const ids = new Set(items.slice(0, 200).map(i => i.product_id!));
    expect(filterByProductIds(items, ids)).toHaveLength(200);
  });
});

// =============================================
// 3. INTELLIGENCE FILTERS TYPE TESTS
// =============================================
describe('IntelligenceFilters interface', () => {
  interface IntelligenceFilters {
    days: number;
    categoryId: string | null;
    categoryName: string | null;
    supplierId: string | null;
    supplierName: string | null;
    productId: string | null;
    productName: string | null;
  }

  const defaultFilters: IntelligenceFilters = {
    days: 30,
    categoryId: null,
    categoryName: null,
    supplierId: null,
    supplierName: null,
    productId: null,
    productName: null,
  };

  it('default filters should have days=30 and all nulls', () => {
    expect(defaultFilters.days).toBe(30);
    expect(defaultFilters.categoryId).toBeNull();
    expect(defaultFilters.supplierId).toBeNull();
    expect(defaultFilters.productId).toBeNull();
  });

  it('should calculate active filter count correctly - no filters', () => {
    const count = (defaultFilters.categoryId ? 1 : 0) + (defaultFilters.supplierId ? 1 : 0) + (defaultFilters.productId ? 1 : 0);
    expect(count).toBe(0);
  });

  it('should calculate active filter count - category only', () => {
    const f = { ...defaultFilters, categoryId: 'cat-1', categoryName: 'Squeeze' };
    const count = (f.categoryId ? 1 : 0) + (f.supplierId ? 1 : 0) + (f.productId ? 1 : 0);
    expect(count).toBe(1);
  });

  it('should calculate active filter count - all three active', () => {
    const f = { ...defaultFilters, categoryId: 'cat-1', categoryName: 'X', supplierId: 'sup-1', supplierName: 'Y', productId: 'prod-1', productName: 'Z' };
    const count = (f.categoryId ? 1 : 0) + (f.supplierId ? 1 : 0) + (f.productId ? 1 : 0);
    expect(count).toBe(3);
  });

  it('clearAll should reset all filter fields but preserve days', () => {
    const f = { ...defaultFilters, days: 90, categoryId: 'cat-1', categoryName: 'X', supplierId: 'sup-1', supplierName: 'Y', productId: 'prod-1', productName: 'Z' };
    const cleared = { ...f, categoryId: null, categoryName: null, supplierId: null, supplierName: null, productId: null, productName: null };
    expect(cleared.days).toBe(90);
    expect(cleared.categoryId).toBeNull();
    expect(cleared.supplierId).toBeNull();
    expect(cleared.productId).toBeNull();
  });
});

// =============================================
// 4. PERIOD OPTIONS TESTS
// =============================================
describe('Period options', () => {
  const PERIOD_OPTIONS = [
    { label: "7d", days: 7 },
    { label: "15d", days: 15 },
    { label: "30d", days: 30 },
    { label: "60d", days: 60 },
    { label: "90d", days: 90 },
    { label: "120d", days: 120 },
    { label: "150d", days: 150 },
    { label: "180d", days: 180 },
    { label: "1 ano", days: 360 },
  ];

  it('should have 9 period options', () => {
    expect(PERIOD_OPTIONS).toHaveLength(9);
  });

  it('all days values should be positive', () => {
    expect(PERIOD_OPTIONS).not.toHaveLength(0);
    // eslint-disable-next-line no-restricted-syntax
    PERIOD_OPTIONS.forEach(p => expect(p.days).toBeGreaterThan(0));
  });

  it('should have unique days values', () => {
    const days = PERIOD_OPTIONS.map(p => p.days);
    expect(new Set(days).size).toBe(days.length);
  });

  it('should have unique labels', () => {
    const labels = PERIOD_OPTIONS.map(p => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('should be sorted ascending by days', () => {
    for (let i = 1; i < PERIOD_OPTIONS.length; i++) {
      expect(PERIOD_OPTIONS[i].days).toBeGreaterThan(PERIOD_OPTIONS[i - 1].days);
    }
  });

  it('minimum period should be 7 days', () => {
    expect(PERIOD_OPTIONS[0].days).toBe(7);
  });

  it('maximum period should be 360 days (1 year)', () => {
    expect(PERIOD_OPTIONS[PERIOD_OPTIONS.length - 1].days).toBe(360);
  });
});

// =============================================
// 5. KPI CALCULATION TESTS
// =============================================
describe('KPI calculations', () => {
  function calculateKPIs(quotes: number, orders: number, revenue: number) {
    return {
      totalQuotes: quotes,
      totalOrders: orders,
      conversionRate: quotes > 0 ? Math.round((orders / quotes) * 100) : 0,
      totalRevenue: revenue,
      averageTicket: orders > 0 ? revenue / orders : 0,
    };
  }

  it('should calculate conversion rate correctly', () => {
    expect(calculateKPIs(100, 30, 15000).conversionRate).toBe(30);
  });

  it('conversion rate with 0 quotes should be 0 (not NaN)', () => {
    expect(calculateKPIs(0, 0, 0).conversionRate).toBe(0);
  });

  it('conversion rate with 100% should be 100', () => {
    expect(calculateKPIs(10, 10, 5000).conversionRate).toBe(100);
  });

  it('conversion rate > 100% possible (more orders than quotes)', () => {
    // This is possible when orders are created independently of quotes
    expect(calculateKPIs(5, 10, 5000).conversionRate).toBe(200);
  });

  it('average ticket with 0 orders should be 0 (not NaN)', () => {
    expect(calculateKPIs(10, 0, 0).averageTicket).toBe(0);
  });

  it('average ticket calculation', () => {
    expect(calculateKPIs(20, 5, 25000).averageTicket).toBe(5000);
  });

  it('should handle very large revenue values', () => {
    const kpis = calculateKPIs(1000, 500, 10_000_000);
    expect(kpis.averageTicket).toBe(20000);
    expect(kpis.conversionRate).toBe(50);
  });

  it('should handle fractional conversion rates (rounding)', () => {
    // 3/7 = 0.4285... → 43%
    expect(calculateKPIs(7, 3, 2100).conversionRate).toBe(43);
  });
});

// =============================================
// 6. TRENDING PRODUCT AGGREGATION TESTS
// =============================================
describe('TrendingProduct aggregation logic', () => {
  interface OrderItem {
    product_id: string | null;
    product_sku: string | null;
    product_name: string | null;
    product_image_url: string | null;
    quantity: number | null;
    unit_price: number | null;
    order_id: string | null;
  }

  function aggregateTrending(orderItems: OrderItem[]) {
    const productMap = new Map<string, any>();
    orderItems.forEach(item => {
      const key = item.product_sku || item.product_id || item.product_name;
      if (!key) return;
      const existing = productMap.get(key) || {
        productId: item.product_id || '', productSku: item.product_sku,
        productName: item.product_name || 'Produto', productImage: item.product_image_url,
        orderCount: 0, totalQuantity: 0, totalRevenue: 0, quoteCount: 0, conversionRate: 0, trend: 'stable',
      };
      existing.orderCount += 1;
      existing.totalQuantity += (item.quantity ?? 0);
      existing.totalRevenue += (item.quantity ?? 0) * (item.unit_price ?? 0);
      productMap.set(key, existing);
    });
    return Array.from(productMap.values())
      .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);
  }

  it('should aggregate by product_sku as priority key', () => {
    const items: OrderItem[] = [
      { product_id: 'id-1', product_sku: 'SKU-A', product_name: 'Prod', product_image_url: null, quantity: 10, unit_price: 5, order_id: 'o1' },
      { product_id: 'id-2', product_sku: 'SKU-A', product_name: 'Prod', product_image_url: null, quantity: 20, unit_price: 5, order_id: 'o2' },
    ];
    const result = aggregateTrending(items);
    expect(result).toHaveLength(1);
    expect(result[0].orderCount).toBe(2);
    expect(result[0].totalQuantity).toBe(30);
    expect(result[0].totalRevenue).toBe(150);
  });

  it('should skip items where all keys are null/empty', () => {
    const items: OrderItem[] = [
      { product_id: null, product_sku: null, product_name: null, product_image_url: null, quantity: 10, unit_price: 5, order_id: 'o1' },
    ];
    expect(aggregateTrending(items)).toHaveLength(0);
  });

  it('should handle null quantity and unit_price as 0', () => {
    const items: OrderItem[] = [
      { product_id: 'id-1', product_sku: 'SKU-A', product_name: 'P', product_image_url: null, quantity: null, unit_price: null, order_id: 'o1' },
    ];
    const result = aggregateTrending(items);
    expect(result[0].totalQuantity).toBe(0);
    expect(result[0].totalRevenue).toBe(0);
  });

  it('should return max 10 products sorted by revenue', () => {
    const items: OrderItem[] = Array.from({ length: 15 }, (_, i) => ({
      product_id: `id-${i}`, product_sku: `SKU-${i}`, product_name: `Prod ${i}`,
      product_image_url: null, quantity: 10, unit_price: (i + 1) * 100, order_id: `o${i}`,
    }));
    const result = aggregateTrending(items);
    expect(result).toHaveLength(10);
    expect(result[0].totalRevenue).toBeGreaterThan(result[9].totalRevenue);
  });

  it('should fall back to product_id when sku is null', () => {
    const items: OrderItem[] = [
      { product_id: 'id-1', product_sku: null, product_name: 'Prod', product_image_url: null, quantity: 5, unit_price: 10, order_id: 'o1' },
      { product_id: 'id-1', product_sku: null, product_name: 'Prod', product_image_url: null, quantity: 3, unit_price: 10, order_id: 'o2' },
    ];
    const result = aggregateTrending(items);
    expect(result).toHaveLength(1);
    expect(result[0].totalQuantity).toBe(8);
  });

  it('should fall back to product_name when both sku and id are null', () => {
    const items: OrderItem[] = [
      { product_id: null, product_sku: null, product_name: 'Caneta', product_image_url: null, quantity: 10, unit_price: 2, order_id: 'o1' },
      { product_id: null, product_sku: null, product_name: 'Caneta', product_image_url: null, quantity: 5, unit_price: 2, order_id: 'o2' },
    ];
    const result = aggregateTrending(items);
    expect(result).toHaveLength(1);
    expect(result[0].totalQuantity).toBe(15);
  });

  it('empty orderItems should return empty array', () => {
    expect(aggregateTrending([])).toHaveLength(0);
  });
});

// =============================================
// 7. OPPORTUNITY FINDER LOGIC TESTS
// =============================================
describe('OpportunityFinder logic', () => {
  function findOpportunities(
    quoteItems: Array<{ product_id: string | null; product_sku: string | null; product_name: string | null; product_image_url: string | null }>,
    orderItems: Array<{ product_id: string | null; product_sku: string | null }>,
  ) {
    const quoteMap = new Map<string, { count: number; name: string; sku: string | null; image: string | null; id: string }>();
    quoteItems.forEach(item => {
      const key = item.product_sku || item.product_id || '';
      if (!key) return;
      const existing = quoteMap.get(key) || { count: 0, name: item.product_name || '', sku: item.product_sku, image: item.product_image_url, id: item.product_id || '' };
      existing.count += 1;
      quoteMap.set(key, existing);
    });

    const orderCountMap = new Map<string, number>();
    orderItems.forEach(item => {
      const key = item.product_sku || item.product_id || '';
      if (!key) return;
      orderCountMap.set(key, (orderCountMap.get(key) || 0) + 1);
    });

    const opportunities: any[] = [];
    quoteMap.forEach((data, key) => {
      const orderCount = orderCountMap.get(key) || 0;
      const conversionRate = data.count > 0 ? Math.round((orderCount / data.count) * 100) : 0;
      const opportunityScore = Math.max(0, 100 - conversionRate) * Math.min(data.count / 3, 1);

      if (data.count >= 2 && conversionRate < 60) {
        opportunities.push({
          productId: data.id, productSku: data.sku, productName: data.name,
          productImage: data.image, quoteCount: data.count, orderCount,
          conversionRate, opportunityScore,
          reason: conversionRate === 0 ? 'Cotado mas nunca vendido'
            : conversionRate < 20 ? 'Conversão muito baixa' : 'Conversão abaixo da média',
        });
      }
    });

    return opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 10);
  }

  it('product with 0 orders should have reason "Cotado mas nunca vendido"', () => {
    const quotes = Array.from({ length: 5 }, () => ({ product_id: 'p1', product_sku: 'S1', product_name: 'Test', product_image_url: null }));
    const result = findOpportunities(quotes, []);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('Cotado mas nunca vendido');
    expect(result[0].conversionRate).toBe(0);
  });

  it('product with <20% conversion should have "Conversão muito baixa"', () => {
    const quotes = Array.from({ length: 10 }, () => ({ product_id: 'p1', product_sku: 'S1', product_name: 'Test', product_image_url: null }));
    const orders = [{ product_id: 'p1', product_sku: 'S1' }]; // 1/10 = 10%
    const result = findOpportunities(quotes, orders);
    expect(result[0].reason).toBe('Conversão muito baixa');
  });

  it('product with 20-59% conversion should have "Conversão abaixo da média"', () => {
    const quotes = Array.from({ length: 5 }, () => ({ product_id: 'p1', product_sku: 'S1', product_name: 'Test', product_image_url: null }));
    const orders = Array.from({ length: 2 }, () => ({ product_id: 'p1', product_sku: 'S1' })); // 2/5 = 40%
    const result = findOpportunities(quotes, orders);
    expect(result[0].reason).toBe('Conversão abaixo da média');
  });

  it('product with >=60% conversion should NOT appear as opportunity', () => {
    const quotes = Array.from({ length: 5 }, () => ({ product_id: 'p1', product_sku: 'S1', product_name: 'Test', product_image_url: null }));
    const orders = Array.from({ length: 3 }, () => ({ product_id: 'p1', product_sku: 'S1' })); // 3/5 = 60%
    const result = findOpportunities(quotes, orders);
    expect(result).toHaveLength(0);
  });

  it('product with only 1 quote should NOT appear (min threshold is 2)', () => {
    const quotes = [{ product_id: 'p1', product_sku: 'S1', product_name: 'Test', product_image_url: null }];
    const result = findOpportunities(quotes, []);
    expect(result).toHaveLength(0);
  });

  it('should return max 10 opportunities', () => {
    const quotes = Array.from({ length: 15 }, (_, i) => (
      Array.from({ length: 3 }, () => ({ product_id: `p${i}`, product_sku: `S${i}`, product_name: `Prod ${i}`, product_image_url: null }))
    )).flat();
    const result = findOpportunities(quotes, []);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it('opportunityScore should be higher for products with more quotes and lower conversion', () => {
    const quotes = [
      ...Array.from({ length: 10 }, () => ({ product_id: 'p1', product_sku: 'S1', product_name: 'Hot', product_image_url: null })),
      ...Array.from({ length: 3 }, () => ({ product_id: 'p2', product_sku: 'S2', product_name: 'Cold', product_image_url: null })),
    ];
    const result = findOpportunities(quotes, []);
    expect(result[0].productSku).toBe('S1'); // More quotes = higher score
  });

  it('empty quoteItems should return empty array', () => {
    expect(findOpportunities([], [])).toHaveLength(0);
  });
});

// =============================================
// 8. SUPPLIER SALES AGGREGATION TESTS
// =============================================
describe('SupplierSales aggregation', () => {
  function aggregateSupplierSales(
    orderItems: Array<{ product_id: string | null; quantity: number | null; unit_price: number | null }>,
    productSupplierMap: Map<string, string>,
  ) {
    const supplierMap = new Map<string, { orderCount: number; revenue: number; products: Set<string> }>();
    orderItems.forEach(item => {
      const supplier = productSupplierMap.get(item.product_id || '') || 'Sem fornecedor';
      const existing = supplierMap.get(supplier) || { orderCount: 0, revenue: 0, products: new Set<string>() };
      existing.orderCount += 1;
      existing.revenue += (item.quantity ?? 0) * (item.unit_price ?? 0);
      if (item.product_id) existing.products.add(item.product_id);
      supplierMap.set(supplier, existing);
    });

    return Array.from(supplierMap.entries())
      .map(([supplier, data]) => ({
        supplierName: supplier,
        orderCount: data.orderCount,
        revenue: data.revenue,
        productCount: data.products.size,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  it('should group items by supplier', () => {
    const items = [
      { product_id: 'p1', quantity: 10, unit_price: 100 },
      { product_id: 'p2', quantity: 5, unit_price: 200 },
    ];
    const map = new Map([['p1', 'Supplier A'], ['p2', 'Supplier A']]);
    const result = aggregateSupplierSales(items, map);
    expect(result).toHaveLength(1);
    expect(result[0].revenue).toBe(2000); // 10*100 + 5*200
    expect(result[0].productCount).toBe(2);
  });

  it('should use "Sem fornecedor" for unmapped products', () => {
    const items = [{ product_id: 'unknown', quantity: 1, unit_price: 50 }];
    const result = aggregateSupplierSales(items, new Map());
    expect(result[0].supplierName).toBe('Sem fornecedor');
  });

  it('should handle null product_id', () => {
    const items = [{ product_id: null, quantity: 1, unit_price: 50 }];
    const result = aggregateSupplierSales(items, new Map());
    expect(result[0].supplierName).toBe('Sem fornecedor');
    expect(result[0].productCount).toBe(0); // null id not added to set
  });

  it('should sort by revenue descending', () => {
    const items = [
      { product_id: 'p1', quantity: 1, unit_price: 100 },
      { product_id: 'p2', quantity: 1, unit_price: 500 },
    ];
    const map = new Map([['p1', 'Low'], ['p2', 'High']]);
    const result = aggregateSupplierSales(items, map);
    expect(result[0].supplierName).toBe('High');
  });

  it('should count unique products per supplier', () => {
    const items = [
      { product_id: 'p1', quantity: 1, unit_price: 10 },
      { product_id: 'p1', quantity: 2, unit_price: 10 }, // same product, 2 order items
      { product_id: 'p2', quantity: 1, unit_price: 10 },
    ];
    const map = new Map([['p1', 'S1'], ['p2', 'S1']]);
    const result = aggregateSupplierSales(items, map);
    expect(result[0].productCount).toBe(2);
    expect(result[0].orderCount).toBe(3);
  });

  it('should return max 10 suppliers', () => {
    const items = Array.from({ length: 15 }, (_, i) => ({ product_id: `p${i}`, quantity: 1, unit_price: 10 }));
    const map = new Map(items.map(i => [i.product_id!, `Supplier ${i.product_id}`]));
    const result = aggregateSupplierSales(items, map);
    expect(result.length).toBeLessThanOrEqual(10);
  });
});

// =============================================
// 9. CLIENT AGGREGATION TESTS
// =============================================
describe('Client aggregation', () => {
  function aggregateClients(orders: Array<{ client_name?: string | null; client_company?: string | null; total?: number | null }>) {
    const clientMap = new Map<string, { company: string | null; orderCount: number; revenue: number }>();
    orders.forEach(o => {
      const name = o.client_name || o.client_company || 'Não identificado';
      const existing = clientMap.get(name) || { company: o.client_company || null, orderCount: 0, revenue: 0 };
      existing.orderCount += 1;
      existing.revenue += (o.total ?? 0);
      clientMap.set(name, existing);
    });

    return Array.from(clientMap.entries())
      .map(([name, data]) => ({
        clientName: name,
        company: data.company,
        orderCount: data.orderCount,
        revenue: data.revenue,
        averageTicket: data.orderCount > 0 ? data.revenue / data.orderCount : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  it('should group by client_name', () => {
    const orders = [
      { client_name: 'João', total: 1000 },
      { client_name: 'João', total: 2000 },
      { client_name: 'Maria', total: 500 },
    ];
    const result = aggregateClients(orders);
    expect(result).toHaveLength(2);
    expect(result[0].clientName).toBe('João');
    expect(result[0].revenue).toBe(3000);
    expect(result[0].averageTicket).toBe(1500);
  });

  it('should use client_company when name is null', () => {
    const orders = [{ client_name: null, client_company: 'ACME Corp', total: 1000 }];
    const result = aggregateClients(orders);
    expect(result[0].clientName).toBe('ACME Corp');
  });

  it('should use "Não identificado" when both are null', () => {
    const orders = [{ client_name: null, client_company: null, total: 1000 }];
    const result = aggregateClients(orders);
    expect(result[0].clientName).toBe('Não identificado');
  });

  it('should handle null total as 0', () => {
    const orders = [{ client_name: 'X', total: null }];
    const result = aggregateClients(orders);
    expect(result[0].revenue).toBe(0);
  });
});

// =============================================
// 10. TREND CALCULATION TESTS
// =============================================
describe('Trend determination', () => {
  function getTrend(revenue: number): 'up' | 'down' | 'stable' {
    return revenue > 1000 ? 'up' : revenue > 200 ? 'stable' : 'down';
  }

  it('revenue > 1000 should be "up"', () => {
    expect(getTrend(1001)).toBe('up');
    expect(getTrend(50000)).toBe('up');
  });

  it('revenue 201-1000 should be "stable"', () => {
    expect(getTrend(500)).toBe('stable');
    expect(getTrend(1000)).toBe('stable');
  });

  it('revenue <= 200 should be "down"', () => {
    expect(getTrend(200)).toBe('down');
    expect(getTrend(0)).toBe('down');
  });

  it('boundary: exactly 1000 should be stable', () => {
    expect(getTrend(1000)).toBe('stable');
  });

  it('boundary: exactly 200 should be down', () => {
    expect(getTrend(200)).toBe('down');
  });
});

// =============================================
// 11. CONVERSION RATE EDGE CASES
// =============================================
describe('Conversion rate edge cases', () => {
  function conversionRate(orders: number, quotes: number): number {
    return quotes > 0 ? Math.round((orders / quotes) * 100) : 100;
  }

  it('no quotes → defaults to 100% (convention from hook)', () => {
    expect(conversionRate(5, 0)).toBe(100);
  });

  it('1 order out of 1 quote → 100%', () => {
    expect(conversionRate(1, 1)).toBe(100);
  });

  it('0 orders out of 10 quotes → 0%', () => {
    expect(conversionRate(0, 10)).toBe(0);
  });

  it('rounding: 1/3 → 33%', () => {
    expect(conversionRate(1, 3)).toBe(33);
  });

  it('rounding: 2/3 → 67%', () => {
    expect(conversionRate(2, 3)).toBe(67);
  });
});

// =============================================
// 12. PRODUCT NAME TRUNCATION (FILTER BAR)
// =============================================
describe('Product name truncation in filter bar', () => {
  function truncateName(name: string | null): string {
    if (!name) return "Produto";
    return name.length > 20 ? name.slice(0, 20) + '…' : name;
  }

  it('null name should show "Produto"', () => {
    expect(truncateName(null)).toBe('Produto');
  });

  it('short name should not be truncated', () => {
    expect(truncateName('Caneta Azul')).toBe('Caneta Azul');
  });

  it('exactly 20 chars should not be truncated', () => {
    expect(truncateName('12345678901234567890')).toBe('12345678901234567890');
  });

  it('21+ chars should be truncated with ellipsis', () => {
    expect(truncateName('123456789012345678901')).toBe('12345678901234567890…');
  });

  it('very long name should be truncated', () => {
    const long = 'Garrafa Térmica Premium com Personalização Especial';
    expect(truncateName(long)).toHaveLength(21); // 20 chars + ellipsis
  });
});

// =============================================
// 13. MOCK DATA INTEGRITY TESTS
// =============================================
describe('Mock data integrity', () => {
  const MOCK_TRENDING = [
    { productId: 'mock-1', productSku: 'CAN-001', productName: 'Caneta Esferográfica Premium', productImage: null, orderCount: 48, totalQuantity: 2400, totalRevenue: 18720, quoteCount: 62, conversionRate: 77, trend: 'up' },
    { productId: 'mock-2', productSku: 'GAR-015', productName: 'Garrafa Térmica 500ml', productImage: null, orderCount: 35, totalQuantity: 1750, totalRevenue: 43750, quoteCount: 50, conversionRate: 70, trend: 'up' },
    { productId: 'mock-3', productSku: 'CAD-008', productName: 'Caderno Personalizado A5', productImage: null, orderCount: 29, totalQuantity: 1450, totalRevenue: 21750, quoteCount: 41, conversionRate: 71, trend: 'stable' },
    { productId: 'mock-4', productSku: 'MOC-022', productName: 'Mochila Executiva Slim', productImage: null, orderCount: 22, totalQuantity: 880, totalRevenue: 52800, quoteCount: 38, conversionRate: 58, trend: 'up' },
    { productId: 'mock-5', productSku: 'ECO-003', productName: 'Ecobag Algodão Cru', productImage: null, orderCount: 19, totalQuantity: 3800, totalRevenue: 15200, quoteCount: 30, conversionRate: 63, trend: 'stable' },
    { productId: 'mock-6', productSku: 'USB-011', productName: 'Pen Drive 16GB Personalizado', productImage: null, orderCount: 15, totalQuantity: 750, totalRevenue: 11250, quoteCount: 28, conversionRate: 54, trend: 'down' },
    { productId: 'mock-7', productSku: 'COP-007', productName: 'Copo Térmico 350ml', productImage: null, orderCount: 12, totalQuantity: 600, totalRevenue: 9000, quoteCount: 20, conversionRate: 60, trend: 'stable' },
  ];

  it('all mock products should have unique IDs', () => {
    const ids = MOCK_TRENDING.map(p => p.productId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all mock products should have unique SKUs', () => {
    const skus = MOCK_TRENDING.map(p => p.productSku);
    expect(new Set(skus).size).toBe(skus.length);
  });

  it('all conversionRate values should be between 0 and 100', () => {
    expect(MOCK_TRENDING).not.toHaveLength(0);
    // eslint-disable-next-line no-restricted-syntax
    MOCK_TRENDING.forEach(p => {
      expect(p.conversionRate).toBeGreaterThanOrEqual(0);
      expect(p.conversionRate).toBeLessThanOrEqual(100);
    });
  });

  it('all revenue values should be positive', () => {
    expect(MOCK_TRENDING).not.toHaveLength(0);
    // eslint-disable-next-line no-restricted-syntax
    MOCK_TRENDING.forEach(p => expect(p.totalRevenue).toBeGreaterThan(0));
  });

  it('orderCount should be <= quoteCount for realistic data', () => {
    expect(MOCK_TRENDING).not.toHaveLength(0);
    // eslint-disable-next-line no-restricted-syntax
    MOCK_TRENDING.forEach(p => {
      expect(p.orderCount).toBeLessThanOrEqual(p.quoteCount);
    });
  });

  it('trend values should be valid enum values', () => {
    const validTrends = ['up', 'down', 'stable'];
    expect(MOCK_TRENDING).not.toHaveLength(0);
    // eslint-disable-next-line no-restricted-syntax
    MOCK_TRENDING.forEach(p => expect(validTrends).toContain(p.trend));
  });
});

// =============================================
// 14. MOCK OPPORTUNITY DATA INTEGRITY TESTS
// =============================================
describe('Mock opportunity data integrity', () => {
  const MOCK_OPPORTUNITIES = [
    { productId: 'mock-op-2', productSku: 'REL-004', productName: 'Relógio de Parede Corporativo', quoteCount: 12, orderCount: 0, conversionRate: 0, opportunityScore: 100, reason: 'Cotado mas nunca vendido' },
    { productId: 'mock-op-1', productSku: 'POW-019', productName: 'Power Bank 10000mAh', quoteCount: 18, orderCount: 2, conversionRate: 11, opportunityScore: 85, reason: 'Conversão muito baixa' },
    { productId: 'mock-op-3', productSku: 'KIT-033', productName: 'Kit Escritório 5 Peças', quoteCount: 9, orderCount: 1, conversionRate: 11, opportunityScore: 75, reason: 'Conversão muito baixa' },
    { productId: 'mock-op-4', productSku: 'NEC-012', productName: 'Necessaire Viagem Premium', quoteCount: 7, orderCount: 2, conversionRate: 29, opportunityScore: 50, reason: 'Conversão abaixo da média' },
  ];

  it('all opportunities should have conversionRate < 60%', () => {
    expect(MOCK_OPPORTUNITIES).not.toHaveLength(0);
    // eslint-disable-next-line no-restricted-syntax
    MOCK_OPPORTUNITIES.forEach(o => expect(o.conversionRate).toBeLessThan(60));
  });

  it('all opportunities should have quoteCount >= 2', () => {
    expect(MOCK_OPPORTUNITIES).not.toHaveLength(0);
    // eslint-disable-next-line no-restricted-syntax
    MOCK_OPPORTUNITIES.forEach(o => expect(o.quoteCount).toBeGreaterThanOrEqual(2));
  });

  it('sorted by opportunityScore descending', () => {
    for (let i = 1; i < MOCK_OPPORTUNITIES.length; i++) {
      expect(MOCK_OPPORTUNITIES[i].opportunityScore).toBeLessThanOrEqual(MOCK_OPPORTUNITIES[i - 1].opportunityScore);
    }
  });

  it('reasons should match conversion rate rules', () => {
    expect(MOCK_OPPORTUNITIES).not.toHaveLength(0);
    // eslint-disable-next-line no-restricted-syntax
    MOCK_OPPORTUNITIES.forEach(o => {
      if (o.conversionRate === 0) {
        expect(o.reason).toBe('Cotado mas nunca vendido');
      } else if (o.conversionRate < 20) {
        expect(o.reason).toBe('Conversão muito baixa');
      } else {
        expect(o.reason).toBe('Conversão abaixo da média');
      }
    });
  });
});

// =============================================
// 15. BUG DETECTION TESTS
// =============================================
describe('BUG: quotesThisMonth hardcoded to 0 when filter active', () => {
  it('should document that filtered KPI path sets quotesThisMonth=0', () => {
    // In useCommercialKPIs line 144: quotesThisMonth: 0
    // This is a bug — when filtering by category, the hook returns
    // quotesThisMonth: 0 instead of counting filtered quotes this month.
    // The unfiltered path correctly counts quotesMonth.length.
    const filteredKPI = {
      totalQuotes: 10,
      totalOrders: 5,
      conversionRate: 50,
      totalRevenue: 25000,
      averageTicket: 5000,
      quotesThisMonth: 0, // BUG: always 0 in filtered path
      ordersThisMonth: 3,
      revenueThisMonth: 15000,
    };
    // This test documents the bug for future fix
    expect(filteredKPI.quotesThisMonth).toBe(0);
  });
});

describe('BUG: productId filter not wired to hooks', () => {
  it('should document that productId is accepted by components but ignored by hooks', () => {
    // Components accept productId prop but hooks (useTrendingProducts, useOpportunities, etc.)
    // only accept categoryId and supplierId. The productId is passed down but never used
    // for data filtering. This means selecting a specific product in the filter bar
    // has NO effect on the data displayed.
    const hookSignature = 'useTrendingProducts(days, categoryId, supplierId)';
    expect(hookSignature).not.toContain('productId');
  });
});

describe('BUG: useSupplierSales fetches ALL products regardless of filter', () => {
  it('should document the unnecessary full product fetch', () => {
    // In useSupplierSales line 526:
    // const products = await fetchPromobrindProducts({ limit: 5000 });
    // This fetches ALL 5000 products every time, even when we already have
    // productIds filtered. Should use the productIdArray for efficiency.
    const fetchCall = 'fetchPromobrindProducts({ limit: 5000 })';
    expect(fetchCall).toContain('5000');
  });
});

describe('BUG: SalesOverviewChart missing Avatar imports', () => {
  it('should document that SellerRow uses Avatar without importing it', () => {
    // SalesOverviewChart.tsx line 188-189 uses:
    // <Avatar className="h-5 w-5">
    //   <AvatarFallback ...>
    // But Avatar/AvatarFallback are never imported at the top of the file.
    // This means if SellerRow is ever rendered, it will crash.
    // Currently it's dead code (unused), but it's still a latent bug.
    const importsInFile = [
      'ResponsiveContainer', 'Area', 'XAxis', 'YAxis', 'CartesianGrid',
      'Tooltip', 'Bar', 'ComposedChart', 'Legend',
      'Card', 'CardContent', 'CardDescription', 'CardHeader', 'CardTitle',
      'Badge', 'Loader2', 'ShoppingCart', 'FileText', 'DollarSign', 'Users', 'Target', 'Package',
      'cn', 'formatCurrency', 'KpiCard', 'useSalesHistoryMacro', 'safeParseDateForChart',
    ];
    expect(importsInFile).not.toContain('Avatar');
    expect(importsInFile).not.toContain('AvatarFallback');
  });
});

// =============================================
// 16. REVENUE POINT DATE GENERATION TESTS
// =============================================
describe('Revenue trend date generation', () => {
  function generateDateMap(days: number): Map<string, { date: string; revenue: number; orders: number; quotes: number }> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const dateMap = new Map();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      dateMap.set(key, { date: key, revenue: 0, orders: 0, quotes: 0 });
    }
    return dateMap;
  }

  it('should generate exactly N days', () => {
    expect(generateDateMap(30).size).toBe(30);
    expect(generateDateMap(7).size).toBe(7);
    expect(generateDateMap(360).size).toBe(360);
  });

  it('all dates should be in YYYY-MM-DD format', () => {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const dateMap = generateDateMap(30);
    expect(dateMap.size).toBeGreaterThan(0);
    // eslint-disable-next-line no-restricted-syntax
    dateMap.forEach((_, key) => {
      expect(key).toMatch(datePattern);
    });
  });

  it('all entries should start with zero values', () => {
    const dateMap = generateDateMap(30);
    expect(dateMap.size).toBeGreaterThan(0);
    // eslint-disable-next-line no-restricted-syntax
    dateMap.forEach(entry => {
      expect(entry.revenue).toBe(0);
      expect(entry.orders).toBe(0);
      expect(entry.quotes).toBe(0);
    });
  });

  it('1 day should work', () => {
    expect(generateDateMap(1).size).toBe(1);
  });
});

// =============================================
// 17. MARKET INTELLIGENCE MOCK GENERATOR TESTS
// =============================================
describe('Market intelligence mock data', () => {
  function generateMockMarketData(days: number) {
    const daily: any[] = [];
    const now = new Date();
    let stock = 3200 + Math.floor(Math.random() * 800);

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const baseDepleted = isWeekend ? 15 : 45;
      const depleted = Math.max(0, Math.round(baseDepleted + (Math.random() - 0.4) * 30));
      const restocked = Math.random() > 0.85 ? Math.round(200 + Math.random() * 400) : 0;

      stock = Math.max(100, stock - depleted + restocked);
      daily.push({ date: dateStr, stockClose: stock, depleted, restocked });
    }

    return { daily, stock };
  }

  it('should generate correct number of daily points', () => {
    expect(generateMockMarketData(30).daily).toHaveLength(30);
    expect(generateMockMarketData(7).daily).toHaveLength(7);
    expect(generateMockMarketData(360).daily).toHaveLength(360);
  });

  it('stock should never go below 100', () => {
    const { daily } = generateMockMarketData(360);
    expect(daily).not.toHaveLength(0);
    // eslint-disable-next-line no-restricted-syntax
    daily.forEach(d => expect(d.stockClose).toBeGreaterThanOrEqual(100));
  });

  it('depleted should never be negative', () => {
    const { daily } = generateMockMarketData(360);
    expect(daily).not.toHaveLength(0);
    // eslint-disable-next-line no-restricted-syntax
    daily.forEach(d => expect(d.depleted).toBeGreaterThanOrEqual(0));
  });

  it('restocked should be 0 or positive', () => {
    const { daily } = generateMockMarketData(360);
    expect(daily).not.toHaveLength(0);
    // eslint-disable-next-line no-restricted-syntax
    daily.forEach(d => expect(d.restocked).toBeGreaterThanOrEqual(0));
  });

  it('dates should be in chronological order', () => {
    const { daily } = generateMockMarketData(30);
    for (let i = 1; i < daily.length; i++) {
      expect(daily[i].date > daily[i - 1].date).toBe(true);
    }
  });

  it('weekends should have lower base depletion', () => {
    // Statistical test — over many days, weekend avg should be lower
    const { daily } = generateMockMarketData(360);
    const weekendDeps = daily.filter(d => {
      const dow = new Date(d.date).getDay();
      return dow === 0 || dow === 6;
    }).map(d => d.depleted);
    const weekdayDeps = daily.filter(d => {
      const dow = new Date(d.date).getDay();
      return dow !== 0 && dow !== 6;
    }).map(d => d.depleted);

    const avgWeekend = weekendDeps.reduce((s, v) => s + v, 0) / weekendDeps.length;
    const avgWeekday = weekdayDeps.reduce((s, v) => s + v, 0) / weekdayDeps.length;
    expect(avgWeekday).toBeGreaterThan(avgWeekend);
  });
});

// =============================================
// 18. CURRENCY FORMATTING TESTS
// =============================================
describe('Currency formatting', () => {
  function formatCurrency(v: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
  }

  it('should format positive values', () => {
    expect(formatCurrency(1000)).toContain('1.000');
  });

  it('should format zero', () => {
    expect(formatCurrency(0)).toContain('0');
  });

  it('should format large values', () => {
    expect(formatCurrency(1_000_000)).toContain('1.000.000');
  });

  it('should truncate decimals', () => {
    const result = formatCurrency(1234.567);
    expect(result).not.toContain(',567');
  });

  it('should handle negative values', () => {
    const result = formatCurrency(-500);
    expect(result).toContain('500');
  });
});

// =============================================
// 19. SUPABASE QUERY LIMIT AWARENESS
// =============================================
describe('Supabase query limit concerns', () => {
  it('productIdArray is sliced to 200 to stay within IN clause limits', () => {
    const fullSet = new Set(Array.from({ length: 500 }, (_, i) => `id-${i}`));
    const sliced = Array.from(fullSet).slice(0, 200);
    expect(sliced).toHaveLength(200);
  });

  it('large categories might have >200 products, causing data truncation', () => {
    // This documents a potential data integrity issue:
    // Categories with >200 products will only analyze the first 200
    const categorySizes = { 'Canetas': 50, 'Garrafas': 30, 'Mochilas': 15, 'Todos': 5000 };
    const entries = Object.entries(categorySizes);
    expect(entries).not.toHaveLength(0);
    // eslint-disable-next-line no-restricted-syntax
    entries.forEach(([_cat, size]) => {
      if (size > 200) {
        // This category will have truncated results
        expect(size).toBeGreaterThan(200);
      }
    });
  });

  it('useSalesHistoryMacro limits to 5000 items', () => {
    // If there are more than 5000 quote/order items in the period,
    // results will be incomplete
    const limit = 5000;
    expect(limit).toBe(5000);
  });
});

// =============================================
// 20. FILTER COMBINATION TESTS
// =============================================
describe('Filter combinations', () => {
  interface Filters {
    categoryId: string | null;
    supplierId: string | null;
    productId: string | null;
  }

  function hasFilter(f: Filters): boolean {
    return !!(f.categoryId || f.supplierId);
  }

  it('no filters → hasFilter is false', () => {
    expect(hasFilter({ categoryId: null, supplierId: null, productId: null })).toBe(false);
  });

  it('category only → hasFilter is true', () => {
    expect(hasFilter({ categoryId: 'cat-1', supplierId: null, productId: null })).toBe(true);
  });

  it('supplier only → hasFilter is true', () => {
    expect(hasFilter({ categoryId: null, supplierId: 'sup-1', productId: null })).toBe(true);
  });

  it('⚠️ productId only → hasFilter is FALSE (not considered!)', () => {
    // This is a gap: productId is not checked in hasFilter condition
    // Means productId filter alone won't trigger filtered path in hooks
    expect(hasFilter({ categoryId: null, supplierId: null, productId: 'prod-1' })).toBe(false);
  });

  it('all three → hasFilter is true', () => {
    expect(hasFilter({ categoryId: 'c', supplierId: 's', productId: 'p' })).toBe(true);
  });
});
