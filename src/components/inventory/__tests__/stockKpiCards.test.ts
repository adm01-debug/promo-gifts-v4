import { describe, it, expect } from 'vitest';
import { buildStockKpiCards } from '../stockKpiCards';
import type { StockDashboardSummary } from '@/types/stock';

const baseSummary: StockDashboardSummary = {
  totalProducts: 7156,
  totalVariants: 18377,
  totalColors: 0,
  productsInStock: 5256,
  productsLowStock: 0,
  productsCritical: 622,
  productsOutOfStock: 1278,
  variantsInStock: 12000,
  variantsLowStock: 0,
  variantsCritical: 1500,
  variantsOutOfStock: 4877,
  totalStockValue: 0,
  totalAvailableValue: 0,
  averageDaysOfStock: 0,
  stockTurnoverRate: 0,
  totalAlerts: 0,
  criticalAlerts: 0,
  incomingStockValue: 0,
};

describe('buildStockKpiCards', () => {
  it('returns the 4 canonical cards in order', () => {
    const cards = buildStockKpiCards(baseSummary);
    expect(cards.map((c) => c.slug)).toEqual([
      'total-de-variacoes',
      'em-estoque',
      'risco-de-ruptura',
      'sem-estoque',
    ]);
  });

  it('uses VARIATION counts (not product counts) for the 4 primary values', () => {
    const cards = buildStockKpiCards(baseSummary);
    const bySlug = Object.fromEntries(cards.map((c) => [c.slug, c]));

    expect(bySlug['total-de-variacoes'].value).toBe(baseSummary.totalVariants);
    expect(bySlug['em-estoque'].value).toBe(baseSummary.variantsInStock);
    expect(bySlug['sem-estoque'].value).toBe(baseSummary.variantsOutOfStock);

    expect(bySlug['em-estoque'].value).not.toBe(baseSummary.productsInStock);
    expect(bySlug['sem-estoque'].value).not.toBe(baseSummary.productsOutOfStock);
  });

  it('Risco de Ruptura uses EMA count (≤ 15 dias) when provided', () => {
    const cards = buildStockKpiCards(baseSummary, 987);
    const rupture = cards.find((c) => c.slug === 'risco-de-ruptura')!;
    expect(rupture.title).toBe('Risco de Ruptura');
    expect(rupture.value).toBe(987);
    expect(rupture.subtitle).toMatch(/15 dias/);
    expect(rupture.tooltip).toMatch(/EMA/);
  });

  it('Risco de Ruptura falls back to variantsCritical when EMA count is null/undefined', () => {
    const cards = buildStockKpiCards(baseSummary, null);
    const rupture = cards.find((c) => c.slug === 'risco-de-ruptura')!;
    expect(rupture.value).toBe(baseSummary.variantsCritical);
    expect(rupture.tooltip).toMatch(/fallback/);
  });

  it('marks all 4 primary cards with unit "variações"', () => {
    for (const card of buildStockKpiCards(baseSummary, 0)) {
      expect(card.unit).toBe('variações');
    }
  });

  it('maps each card to the correct filter slug', () => {
    const cards = buildStockKpiCards(baseSummary);
    expect(cards[0].filter).toBe('all');
    expect(cards[1].filter).toBe('in_stock');
    expect(cards[2].filter).toBe('critical');
    expect(cards[3].filter).toBe('out_of_stock');
  });

  it('handles a zero-summary safely (no NaN)', () => {
    const empty: StockDashboardSummary = {
      ...baseSummary,
      totalProducts: 0,
      totalVariants: 0,
      productsInStock: 0,
      productsCritical: 0,
      productsOutOfStock: 0,
      variantsInStock: 0,
      variantsCritical: 0,
      variantsOutOfStock: 0,
    };
    for (const card of buildStockKpiCards(empty, 0)) {
      expect(card.value).toBe(0);
      expect(card.subtitle).not.toMatch(/NaN/);
    }
  });
});
