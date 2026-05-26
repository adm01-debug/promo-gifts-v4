import { describe, it, expect } from 'vitest';
import { validateDiscount } from '@/hooks/quotes/quoteHelpers';

describe('quoteHelpers validation logic', () => {
  it('throws error when percent is > 100', () => {
    const quote = { discount_percent: 105 };
    const totals = { subtotal: 1000, discountAmount: 1050 };
    expect(() => validateDiscount(quote, totals)).toThrow(
      'Desconto em porcentagem deve estar entre 0% e 100%',
    );
  });

  it('throws error when amount is > subtotal', () => {
    const quote = { discount_amount: 1100 };
    const totals = { subtotal: 1000, discountAmount: 1100 };
    expect(() => validateDiscount(quote, totals)).toThrow(/O desconto não pode exceder o subtotal/);
  });

  it('throws error when discount is negative', () => {
    const quote = { discount_amount: -10 };
    const totals = { subtotal: 1000, discountAmount: -10 };
    expect(() => validateDiscount(quote, totals)).toThrow(
      'O valor do desconto não pode ser negativo',
    );
  });

  it('passes for valid discount (edge cases)', () => {
    // 100% discount
    expect(() =>
      validateDiscount({ discount_percent: 100 }, { subtotal: 1000, discountAmount: 1000 }),
    ).not.toThrow();
    // 0% discount
    expect(() =>
      validateDiscount({ discount_percent: 0 }, { subtotal: 1000, discountAmount: 0 }),
    ).not.toThrow();
    // Tolerance check (floating point)
    expect(() => validateDiscount({}, { subtotal: 100.0, discountAmount: 100.009 })).not.toThrow();
  });
});
