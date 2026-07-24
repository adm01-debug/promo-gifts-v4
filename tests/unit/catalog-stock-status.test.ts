/**
 * Unit tests for src/lib/catalog-stock-status.ts
 *
 * getCatalogStockStatus, getCatalogStockStatusLabel, getCatalogStockStatusColor
 */
import { describe, it, expect } from 'vitest';
import {
  getCatalogStockStatus,
  getCatalogStockStatusLabel,
  getCatalogStockStatusColor,
  CATALOG_LOW_STOCK_THRESHOLD,
} from '@/lib/catalog-stock-status';

describe('getCatalogStockStatus', () => {
  it('exports CATALOG_LOW_STOCK_THRESHOLD = 10', () => {
    expect(CATALOG_LOW_STOCK_THRESHOLD).toBe(10);
  });

  it('returns out-of-stock for null', () => {
    expect(getCatalogStockStatus(null)).toBe('out-of-stock');
  });

  it('returns out-of-stock for undefined', () => {
    expect(getCatalogStockStatus(undefined)).toBe('out-of-stock');
  });

  it('returns out-of-stock for NaN (non-finite)', () => {
    expect(getCatalogStockStatus(NaN)).toBe('out-of-stock');
  });

  it('returns out-of-stock for Infinity', () => {
    expect(getCatalogStockStatus(Infinity)).toBe('out-of-stock');
  });

  it('returns out-of-stock for 0', () => {
    expect(getCatalogStockStatus(0)).toBe('out-of-stock');
  });

  it('returns out-of-stock for negative values', () => {
    expect(getCatalogStockStatus(-1)).toBe('out-of-stock');
    expect(getCatalogStockStatus(-100)).toBe('out-of-stock');
  });

  it('returns low-stock for 1 (below default threshold)', () => {
    expect(getCatalogStockStatus(1)).toBe('low-stock');
  });

  it('returns low-stock for 9 (one below default threshold)', () => {
    expect(getCatalogStockStatus(9)).toBe('low-stock');
  });

  it('returns in-stock at exactly the default threshold (10)', () => {
    expect(getCatalogStockStatus(10)).toBe('in-stock');
  });

  it('returns in-stock for values above default threshold', () => {
    expect(getCatalogStockStatus(11)).toBe('in-stock');
    expect(getCatalogStockStatus(1000)).toBe('in-stock');
  });

  it('respects custom lowStockThreshold', () => {
    expect(getCatalogStockStatus(5, 20)).toBe('low-stock');
    expect(getCatalogStockStatus(19, 20)).toBe('low-stock');
    expect(getCatalogStockStatus(20, 20)).toBe('in-stock');
  });

  it('threshold of 1 means any positive qty is in-stock', () => {
    expect(getCatalogStockStatus(1, 1)).toBe('in-stock');
    expect(getCatalogStockStatus(0, 1)).toBe('out-of-stock');
  });
});

describe('getCatalogStockStatusLabel', () => {
  it('returns "Em estoque" for in-stock', () => {
    expect(getCatalogStockStatusLabel('in-stock')).toBe('Em estoque');
  });

  it('returns "Estoque baixo" for low-stock', () => {
    expect(getCatalogStockStatusLabel('low-stock')).toBe('Estoque baixo');
  });

  it('returns "Estoque zerado" for out-of-stock', () => {
    expect(getCatalogStockStatusLabel('out-of-stock')).toBe('Estoque zerado');
  });

  it('falls back to "Em estoque" for unknown strings', () => {
    expect(getCatalogStockStatusLabel('unknown')).toBe('Em estoque');
    expect(getCatalogStockStatusLabel('')).toBe('Em estoque');
  });
});

describe('getCatalogStockStatusColor', () => {
  it('returns token matching the status key', () => {
    expect(getCatalogStockStatusColor('in-stock')).toBe('in-stock');
    expect(getCatalogStockStatusColor('low-stock')).toBe('low-stock');
    expect(getCatalogStockStatusColor('out-of-stock')).toBe('out-of-stock');
  });

  it('falls back to in-stock color for unknown status', () => {
    expect(getCatalogStockStatusColor('bogus')).toBe('in-stock');
  });
});
