import { describe, it, expect } from 'vitest';
import {
  calcHealthScore,
  getHealthBand,
  bucketByStatus,
  countCriticalAlerts,
} from '../health-score';
import type { ProductStockSummary, StockStatus } from '@/types/stock';

const makeProduct = (id: string, overallStatus: StockStatus): ProductStockSummary => ({
  productId: id,
  productName: `P-${id}`,
  productSku: `SKU-${id}`,
  totalCurrentStock: 0,
  totalMinStock: 0,
  totalReservedStock: 0,
  totalInTransitStock: 0,
  totalAvailableStock: 0,
  overallStatus,
  variantsInStock: 0,
  variantsLowStock: 0,
  variantsCritical: 0,
  variantsOutOfStock: 0,
  totalVariants: 0,
  variants: [],
  availableColors: [],
});

describe('calcHealthScore', () => {
  it('retorna 100 quando não há produtos', () => {
    expect(calcHealthScore({ productsInStock: 0, totalProducts: 0 })).toBe(100);
  });

  it('retorna 100 quando todos estão adequados', () => {
    expect(calcHealthScore({ productsInStock: 50, totalProducts: 50 })).toBe(100);
  });

  it('retorna 0 quando nenhum está adequado', () => {
    expect(calcHealthScore({ productsInStock: 0, totalProducts: 100 })).toBe(0);
  });

  it('arredonda corretamente (2/3 → 67)', () => {
    expect(calcHealthScore({ productsInStock: 2, totalProducts: 3 })).toBe(67);
  });

  it('arredonda corretamente (1420/2100 → 68)', () => {
    expect(calcHealthScore({ productsInStock: 1420, totalProducts: 2100 })).toBe(68);
  });

  it('faz clamp em entradas absurdas (>100% ou negativas)', () => {
    expect(calcHealthScore({ productsInStock: 200, totalProducts: 100 })).toBe(100);
    expect(calcHealthScore({ productsInStock: -5, totalProducts: 100 })).toBe(0);
  });
});

describe('getHealthBand', () => {
  it('classifica como good para ≥ 80', () => {
    expect(getHealthBand(80)).toBe('good');
    expect(getHealthBand(100)).toBe('good');
  });
  it('classifica como warning para 50–79', () => {
    expect(getHealthBand(79)).toBe('warning');
    expect(getHealthBand(50)).toBe('warning');
  });
  it('classifica como danger para < 50', () => {
    expect(getHealthBand(49)).toBe('danger');
    expect(getHealthBand(0)).toBe('danger');
  });
});

describe('bucketByStatus', () => {
  it('separa produtos por status overall', () => {
    const products = [
      makeProduct('1', 'in_stock'),
      makeProduct('2', 'in_stock'),
      makeProduct('3', 'low_stock'),
      makeProduct('4', 'critical'),
      makeProduct('5', 'critical'),
      makeProduct('6', 'out_of_stock'),
      makeProduct('7', 'incoming'),
      makeProduct('8', 'overstocked'),
    ];
    const b = bucketByStatus(products);
    expect(b.healthy.map((p) => p.productId).sort()).toEqual(['1', '2', '8']);
    expect(b.low.map((p) => p.productId)).toEqual(['3']);
    expect(b.critical.map((p) => p.productId).sort()).toEqual(['4', '5']);
    expect(b.out.map((p) => p.productId)).toEqual(['6']);
    expect(b.incoming.map((p) => p.productId)).toEqual(['7']);
  });

  it('retorna buckets vazios quando não há produtos', () => {
    expect(bucketByStatus([])).toEqual({
      healthy: [],
      low: [],
      critical: [],
      out: [],
      incoming: [],
    });
  });
});

describe('countCriticalAlerts', () => {
  it('conta só severity === "error"', () => {
    const alerts = [
      { severity: 'error' },
      { severity: 'warning' },
      { severity: 'error' },
      { severity: 'info' },
    ];
    expect(countCriticalAlerts(alerts)).toBe(2);
  });

  it('retorna 0 sem alertas críticos', () => {
    expect(countCriticalAlerts([{ severity: 'warning' }, { severity: 'info' }])).toBe(0);
  });

  it('retorna 0 com lista vazia', () => {
    expect(countCriticalAlerts([])).toBe(0);
  });
});
