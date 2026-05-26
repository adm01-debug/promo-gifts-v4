import { describe, it, expect } from 'vitest';
import {
  calculateItemPersonalizationTotal,
  calculateItemTotal,
  applyMarkup,
  calculateDiscountAmount,
  calculateRealDiscountPercent,
} from '../calculations';

describe('calculations.ts edge cases', () => {
  describe('calculateItemPersonalizationTotal', () => {
    it('handles empty personalizations', () => {
      expect(calculateItemPersonalizationTotal({ personalizations: [] })).toBe(0);
    });

    it('handles null total_cost in personalization', () => {
      expect(
        calculateItemPersonalizationTotal({
          personalizations: [{ total_cost: undefined }, { total_cost: 10 }] as any,
        }),
      ).toBe(10);
    });

    it('handles undefined personalizations', () => {
      expect(calculateItemPersonalizationTotal({})).toBe(0);
    });
  });

  describe('calculateItemTotal', () => {
    it('handles floating point precision', () => {
      // 0.1 + 0.2 is famously not 0.3 in IEEE 754
      const item = { quantity: 1, unitPrice: 0.1, personalizations: [{ total_cost: 0.2 }] };
      expect(calculateItemTotal(item)).toBeCloseTo(0.3, 10);
    });

    it('handles zero quantity', () => {
      expect(calculateItemTotal({ quantity: 0, unitPrice: 100 })).toBe(0);
    });
  });

  describe('applyMarkup', () => {
    it('caps markup at 50%', () => {
      expect(applyMarkup(100, 60)).toBe(150);
    });

    it('prevents negative markup', () => {
      expect(applyMarkup(100, -10)).toBe(100);
    });

    it('handles high precision base values', () => {
      expect(applyMarkup(123.4567, 10)).toBe(135.8); // 123.4567 * 1.1 = 135.80237 -> 135.8
    });

    it('handles zero base value', () => {
      expect(applyMarkup(0, 10)).toBe(0);
    });
  });

  describe('calculateDiscountAmount', () => {
    it('clumps negative discount values to 0', () => {
      expect(calculateDiscountAmount(100, 'percent', -10)).toBe(0);
      expect(calculateDiscountAmount(100, 'amount', -50)).toBe(0);
    });

    it('handles null or undefined values as 0', () => {
      expect(calculateDiscountAmount(100, 'percent', null as any)).toBe(0);
      expect(calculateDiscountAmount(undefined as any, 'percent', 10)).toBe(0);
    });

    it('handles 100% discount', () => {
      expect(calculateDiscountAmount(500, 'percent', 100)).toBe(500);
    });
  });

  describe('calculateRealDiscountPercent', () => {
    it('prevents division by zero', () => {
      expect(calculateRealDiscountPercent(0, 100, 10)).toBe(0);
      expect(calculateRealDiscountPercent(null as any, 100, 10)).toBe(0);
    });

    it('handles cases where presented subtotal is higher than real (markup)', () => {
      // real: 100, presented: 120, discount: 10 -> final: 110.
      // formula: ((realSubtotal - finalBeforeShipping) / realSubtotal) * 100
      // ((100 - (120 - 10)) / 100) * 100 = -10%
      expect(calculateRealDiscountPercent(100, 120, 10)).toBe(-10);
    });

    it('handles negative result when markup exceeds discount', () => {
      // real: 1000, presented: 1200, discount: 50 -> final: 1150
      // ((1000 - 1150) / 1000) * 100 = -15%
      expect(calculateRealDiscountPercent(1000, 1200, 50)).toBe(-15);
    });

    it('handles high precision rounding (2 decimal places)', () => {
      // (100 - 90.1234) / 100 = 0.098766 -> 9.88%
      expect(calculateRealDiscountPercent(100, 100, 9.8766)).toBe(9.88);
    });

    it('handles cases where discount exceeds subtotal', () => {
      // real: 100, presented: 100, discount: 150 -> final: 0. Real discount: 100%
      expect(calculateRealDiscountPercent(100, 100, 150)).toBe(100);
    });
  });

  describe('Markup Boundary Cases', () => {
    it('handles markup exactly at 50% limit', () => {
      expect(applyMarkup(100, 50)).toBe(150);
    });

    it('handles markup above 50% (capped)', () => {
      expect(applyMarkup(100, 51)).toBe(150);
      expect(applyMarkup(100, 1000)).toBe(150);
    });

    it('handles null/undefined markup as 0', () => {
      expect(applyMarkup(100, null as any)).toBe(100);
      expect(applyMarkup(100, undefined as any)).toBe(100);
    });
  });
});
