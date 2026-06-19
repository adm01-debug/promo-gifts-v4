import { describe, it, expect } from 'vitest';
import * as Calc from './calculations';

describe('Financial Calculations Edge Cases', () => {
  const items = [
    { quantity: 100, unitPrice: 10.0 }, // 1000.00
    { quantity: 1, unitPrice: 0.01 }, // 0.01
  ];

  it('should handle 0% discount correctly', () => {
    const subtotal = Calc.calculateSubtotal(items); // 1000.01
    const discount = Calc.calculateDiscountAmount(subtotal, 'percent', 0);
    expect(discount).toBe(0);
    expect(subtotal - discount).toBe(1000.01);
  });

  it('should handle 100% discount correctly', () => {
    const subtotal = Calc.calculateSubtotal(items);
    const discount = Calc.calculateDiscountAmount(subtotal, 'percent', 100);
    expect(discount).toBe(1000.01);
    expect(Calc.round2(subtotal - discount)).toBe(0);
  });

  it('should handle fixed amount discount correctly', () => {
    const subtotal = Calc.calculateSubtotal(items);
    const discount = Calc.calculateDiscountAmount(subtotal, 'amount', 50.5);
    expect(discount).toBe(50.5);
    expect(Calc.round2(subtotal - discount)).toBe(949.51);
  });

  it('should handle 2-decimal rounding for complex values', () => {
    // In calculations.ts: calculateItemTotal = round2(item.quantity * item.unitPrice + ...)
    expect(Calc.calculateItemTotal({ quantity: 3, unitPrice: 10.3333 })).toBe(31.0);
    expect(Calc.calculateItemTotal({ quantity: 1, unitPrice: 0.3333 })).toBe(0.33);
  });

  it('should calculate real discount percent correctly after markup', () => {
    const realSubtotal = 1000;
    const markup = 10; // 10% markup -> presentedSubtotal = 1100
    const presentedSubtotal = Calc.applyMarkup(realSubtotal, markup);
    expect(presentedSubtotal).toBe(1100);

    const discountValue = 100; // presented subtotal - 100 = 1000
    const discountAmount = Calc.calculateDiscountAmount(presentedSubtotal, 'amount', discountValue);

    // realSubtotal was 1000, final is 1000 -> real discount is 0%
    const realDiscount = Calc.calculateRealDiscountPercent(
      realSubtotal,
      presentedSubtotal,
      discountAmount,
    );
    expect(realDiscount).toBe(0);
  });
});
