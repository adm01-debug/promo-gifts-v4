import { describe, it, expect } from 'vitest';
import { buildStockKpiCards } from '../stockKpiCards';
import type { StockDashboardSummary } from '@/types/stock';

const baseSummary: StockDashboardSummary = {
  totalProducts: 7156,
  totalVariants: 18377,
  productsInStock: 5256,
  productsLowStock: 0,
  productsCritical: 622,
  productsOutOfStock: 1278,
  variantsInStock: 12000,
  variantsLowStock: 0,
  variantsCritical: 1500,
  variantsOutOfStock: 4877,
  averageDaysUntilStockout: 0,
  totalColors: 0,
  totalCategories: 0,
};

describe('buildStockKpiCards', () => {
  it('returns the 4 canonical cards in order', () => {
    const cards = buildStockKpiCards(baseSummary);
    expect(cards.map((c) => c.slug)).toEqual([
      'total-de-variacoes',
      'em-estoque',
      'critico',
      'sem-estoque',
    ]);
  });

  it('uses VARIATION counts (not product counts) for the 4 primary values', () => {
    const cards = buildStockKpiCards(baseSummary);
    const bySlug = Object.fromEntries(cards.map((c) => [c.slug, c]));

    expect(bySlug['total-de-variacoes'].value).toBe(baseSummary.totalVariants);
    expect(bySlug['em-estoque'].value).toBe(baseSummary.variantsInStock);
    expect(bySlug['critico'].value).toBe(baseSummary.variantsCritical);
    expect(bySlug['sem-estoque'].value).toBe(baseSummary.variantsOutOfStock);

    // Sanity: garantir que NÃO estamos usando os contadores por produto
    expect(bySlug['em-estoque'].value).not.toBe(baseSummary.productsInStock);
    expect(bySlug['critico'].value).not.toBe(baseSummary.productsCritical);
    expect(bySlug['sem-estoque'].value).not.toBe(baseSummary.productsOutOfStock);
  });

  it('marks all 4 primary cards with unit "variações"', () => {
    for (const card of buildStockKpiCards(baseSummary)) {
      expect(card.unit).toBe('variações');
    }
  });

  it('mentions "produtos" in subtitle/tooltip for cross-reference', () => {
    const cards = buildStockKpiCards(baseSummary);
    expect(cards[0].subtitle).toContain('produtos');
    expect(cards[3].subtitle).toContain('produtos');
    for (const card of cards) {
      expect(card.tooltip.length).toBeGreaterThan(20);
    }
  });

  it('maps each card to the correct filter slug', () => {
    const cards = buildStockKpiCards(baseSummary);
    expect(cards[0].filter).toBe('all');
    expect(cards[1].filter).toBe('in_stock');
    expect(cards[2].filter).toBe('critical');
    expect(cards[3].filter).toBe('out_of_stock');
  });

  it('handles a zero-summary safely (no division-by-zero / NaN)', () => {
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
    for (const card of buildStockKpiCards(empty)) {
      expect(card.value).toBe(0);
      expect(card.subtitle).not.toMatch(/NaN/);
    }
  });
});
