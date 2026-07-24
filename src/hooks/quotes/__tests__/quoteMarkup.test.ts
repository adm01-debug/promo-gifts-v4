import { describe, it, expect } from 'vitest';
import { applyNegotiationMarkup, negotiationMarkupFactor } from '../quoteMarkup';
import type { QuoteItem } from '../quoteTypes';

const baseItem = (overrides: Partial<QuoteItem> = {}): QuoteItem => ({
  product_id: 'p1',
  product_name: 'Caneca',
  quantity: 10,
  unit_price: 100,
  ...overrides,
});

describe('negotiationMarkupFactor', () => {
  it('returns 1 for 0/undefined/null/negative markup', () => {
    expect(negotiationMarkupFactor(0)).toBe(1);
    expect(negotiationMarkupFactor(undefined)).toBe(1);
    expect(negotiationMarkupFactor(null)).toBe(1);
    expect(negotiationMarkupFactor(-10)).toBe(1);
  });

  it('computes 1 + pct/100 for valid markup', () => {
    expect(negotiationMarkupFactor(10)).toBeCloseTo(1.1, 10);
    expect(negotiationMarkupFactor(50)).toBe(1.5);
  });

  it('clamps to the 50% ceiling (matches quoteHelpers MARKUP_MAX_PERCENT)', () => {
    expect(negotiationMarkupFactor(51)).toBe(1.5);
    expect(negotiationMarkupFactor(999)).toBe(1.5);
  });
});

describe('applyNegotiationMarkup', () => {
  it('is a no-op (same reference) when markup is 0', () => {
    const items = [baseItem()];
    expect(applyNegotiationMarkup(items, 0)).toBe(items);
    expect(applyNegotiationMarkup(items, undefined)).toBe(items);
  });

  it('scales unit_price by the markup factor with 2-decimal rounding', () => {
    const [item] = applyNegotiationMarkup([baseItem({ unit_price: 100 })], 10);
    expect(item.unit_price).toBe(110); // 100 * 1.1
  });

  it('scales personalization setup/unit/total costs by the factor', () => {
    const [item] = applyNegotiationMarkup(
      [
        baseItem({
          personalizations: [
            {
              technique_id: 't1',
              setup_cost: 50,
              unit_cost: 2.5,
              total_cost: 75,
            },
          ],
        }),
      ],
      10,
    );
    expect(item.personalizations?.[0]).toMatchObject({
      setup_cost: 55, // 50 * 1.1
      unit_cost: 2.75, // 2.5 * 1.1
      total_cost: 82.5, // 75 * 1.1
    });
  });

  it('keeps the displayed subtotal consistent with the persisted (marked-up) subtotal', () => {
    // realSubtotal = 10 * 100 = 1000; with 10% markup the persisted subtotal is 1100.
    const marked = applyNegotiationMarkup([baseItem({ unit_price: 100, quantity: 10 })], 10);
    const displayedSubtotal = marked.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    expect(displayedSubtotal).toBe(1100);
  });

  it('does not mutate the input items', () => {
    const items = [baseItem({ unit_price: 100 })];
    applyNegotiationMarkup(items, 25);
    expect(items[0].unit_price).toBe(100);
  });

  it('handles items without personalizations', () => {
    const [item] = applyNegotiationMarkup([baseItem({ personalizations: undefined })], 10);
    expect(item.unit_price).toBe(110);
    expect(item.personalizations).toBeUndefined();
  });
});
