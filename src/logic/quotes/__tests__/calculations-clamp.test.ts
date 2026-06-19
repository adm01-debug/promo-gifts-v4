/**
 * Exhaustive test suite for calculateDiscountAmount clamping behavior
 * and the round2 helper from @/logic/quotes/calculations.
 *
 * Covers: normal cases, boundary values, over-limit clamping, negative inputs,
 * NaN/undefined/null coercion, floating-point precision, and a 500+ iteration
 * property-based fuzz using a deterministic seeded PRNG (mulberry32).
 */
import { describe, it, expect } from 'vitest';
import { calculateDiscountAmount, round2 } from '@/logic/quotes/calculations';

// ---------------------------------------------------------------------------
// Seeded PRNG — mulberry32 (deterministic, reproducible across runs)
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 1. round2 helper
// ---------------------------------------------------------------------------
describe('round2 helper', () => {
  it('rounds to 2 decimal places (half-up)', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(1.004)).toBe(1.0);
    expect(round2(1.115)).toBe(1.12);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it('handles zero', () => {
    expect(round2(0)).toBe(0);
    expect(round2(-0)).toBe(0);
  });

  it('handles integers', () => {
    expect(round2(100)).toBe(100);
    expect(round2(999999)).toBe(999999);
  });

  it('handles negative numbers', () => {
    expect(round2(-1.005)).toBe(-1.0);
    expect(round2(-99.999)).toBe(-100.0);
  });

  it('coerces null to 0', () => {
    expect(round2(null)).toBe(0);
  });

  it('coerces undefined to 0', () => {
    expect(round2(undefined)).toBe(0);
  });

  it('coerces NaN to 0', () => {
    expect(round2(NaN)).toBe(0);
  });

  it('coerces Infinity to 0', () => {
    expect(round2(Infinity)).toBe(0);
    expect(round2(-Infinity)).toBe(0);
  });

  it('handles very small positive numbers', () => {
    expect(round2(0.001)).toBe(0);
    expect(round2(0.005)).toBe(0.01);
    expect(round2(0.009)).toBe(0.01);
  });

  it('handles very large numbers', () => {
    expect(round2(1_000_000.999)).toBe(1_000_001.0);
    expect(round2(1_000_000.001)).toBe(1_000_000.0);
  });
});

// ---------------------------------------------------------------------------
// 2. calculateDiscountAmount — Normal cases
// ---------------------------------------------------------------------------
describe('calculateDiscountAmount — normal cases', () => {
  it('10% of 1000 => 100', () => {
    expect(calculateDiscountAmount(1000, 'percent', 10)).toBe(100);
  });

  it('50% of 500 => 250', () => {
    expect(calculateDiscountAmount(500, 'percent', 50)).toBe(250);
  });

  it('25% of 200 => 50', () => {
    expect(calculateDiscountAmount(200, 'percent', 25)).toBe(50);
  });

  it('1% of 10000 => 100', () => {
    expect(calculateDiscountAmount(10000, 'percent', 1)).toBe(100);
  });

  it('amount 100 on subtotal 1000 => 100', () => {
    expect(calculateDiscountAmount(1000, 'amount', 100)).toBe(100);
  });

  it('amount 50.50 on subtotal 1000 => 50.50', () => {
    expect(calculateDiscountAmount(1000, 'amount', 50.5)).toBe(50.5);
  });

  it('amount 999.99 on subtotal 1000 => 999.99', () => {
    expect(calculateDiscountAmount(1000, 'amount', 999.99)).toBe(999.99);
  });

  it('amount equal to subtotal => subtotal', () => {
    expect(calculateDiscountAmount(500, 'amount', 500)).toBe(500);
  });

  it('5% of 1 => 0.05', () => {
    expect(calculateDiscountAmount(1, 'percent', 5)).toBe(0.05);
  });

  it('75% of 400 => 300', () => {
    expect(calculateDiscountAmount(400, 'percent', 75)).toBe(300);
  });

  it('amount 0.01 on subtotal 100 => 0.01', () => {
    expect(calculateDiscountAmount(100, 'amount', 0.01)).toBe(0.01);
  });

  it('99% of 100 => 99', () => {
    expect(calculateDiscountAmount(100, 'percent', 99)).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// 3. Boundary values
// ---------------------------------------------------------------------------
describe('calculateDiscountAmount — boundary values', () => {
  it('0% discount => 0', () => {
    expect(calculateDiscountAmount(1000, 'percent', 0)).toBe(0);
  });

  it('100% discount => full subtotal', () => {
    expect(calculateDiscountAmount(1000, 'percent', 100)).toBe(1000);
  });

  it('0 subtotal with percent => 0', () => {
    expect(calculateDiscountAmount(0, 'percent', 50)).toBe(0);
  });

  it('0 subtotal with amount => 0', () => {
    expect(calculateDiscountAmount(0, 'amount', 100)).toBe(0);
  });

  it('0 amount discount => 0', () => {
    expect(calculateDiscountAmount(1000, 'amount', 0)).toBe(0);
  });

  it('both subtotal and discount are 0 (percent) => 0', () => {
    expect(calculateDiscountAmount(0, 'percent', 0)).toBe(0);
  });

  it('both subtotal and discount are 0 (amount) => 0', () => {
    expect(calculateDiscountAmount(0, 'amount', 0)).toBe(0);
  });

  it('subtotal 0.01 with 100% => 0.01', () => {
    expect(calculateDiscountAmount(0.01, 'percent', 100)).toBe(0.01);
  });

  it('subtotal 0.01 with amount 0.01 => 0.01', () => {
    expect(calculateDiscountAmount(0.01, 'amount', 0.01)).toBe(0.01);
  });

  it('very small percent (0.01%) of large subtotal', () => {
    // 0.01% of 10000 = 1.00
    expect(calculateDiscountAmount(10000, 'percent', 0.01)).toBe(1);
  });

  it('very small percent (0.001%) of large subtotal', () => {
    // 0.001% of 10000 = 0.10
    expect(calculateDiscountAmount(10000, 'percent', 0.001)).toBe(0.1);
  });

  it('amount 0.001 rounds to 0', () => {
    expect(calculateDiscountAmount(1000, 'amount', 0.001)).toBe(0);
  });

  it('amount 0.005 rounds to 0.01', () => {
    expect(calculateDiscountAmount(1000, 'amount', 0.005)).toBe(0.01);
  });
});

// ---------------------------------------------------------------------------
// 4. Over-limit clamping
// ---------------------------------------------------------------------------
describe('calculateDiscountAmount — over-limit clamping', () => {
  it('150% discount clamps to 100% => returns full subtotal', () => {
    expect(calculateDiscountAmount(1000, 'percent', 150)).toBe(1000);
  });

  it('200% discount clamps to 100%', () => {
    expect(calculateDiscountAmount(500, 'percent', 200)).toBe(500);
  });

  it('1000% discount clamps to 100%', () => {
    expect(calculateDiscountAmount(250, 'percent', 1000)).toBe(250);
  });

  it('101% discount clamps to 100%', () => {
    expect(calculateDiscountAmount(100, 'percent', 101)).toBe(100);
  });

  it('100.01% discount clamps to 100%', () => {
    expect(calculateDiscountAmount(100, 'percent', 100.01)).toBe(100);
  });

  it('amount 2000 on subtotal 500 clamps to 500', () => {
    expect(calculateDiscountAmount(500, 'amount', 2000)).toBe(500);
  });

  it('amount 501 on subtotal 500 clamps to 500', () => {
    expect(calculateDiscountAmount(500, 'amount', 501)).toBe(500);
  });

  it('amount 1000000 on subtotal 0.01 clamps to 0.01', () => {
    expect(calculateDiscountAmount(0.01, 'amount', 1000000)).toBe(0.01);
  });

  it('amount 500.01 on subtotal 500 clamps to 500', () => {
    expect(calculateDiscountAmount(500, 'amount', 500.01)).toBe(500);
  });

  it('99999% discount clamps to subtotal', () => {
    expect(calculateDiscountAmount(42, 'percent', 99999)).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// 5. Negative inputs
// ---------------------------------------------------------------------------
describe('calculateDiscountAmount — negative inputs', () => {
  it('negative discount value (percent) treated as 0 => 0', () => {
    expect(calculateDiscountAmount(1000, 'percent', -10)).toBe(0);
  });

  it('negative discount value (amount) treated as 0 => 0', () => {
    expect(calculateDiscountAmount(1000, 'amount', -50)).toBe(0);
  });

  it('negative subtotal (percent) treated as 0 => 0', () => {
    expect(calculateDiscountAmount(-500, 'percent', 10)).toBe(0);
  });

  it('negative subtotal (amount) treated as 0 => 0', () => {
    expect(calculateDiscountAmount(-500, 'amount', 100)).toBe(0);
  });

  it('both negative (percent) => 0', () => {
    expect(calculateDiscountAmount(-1000, 'percent', -50)).toBe(0);
  });

  it('both negative (amount) => 0', () => {
    expect(calculateDiscountAmount(-1000, 'amount', -200)).toBe(0);
  });

  it('negative subtotal with 100% => 0', () => {
    expect(calculateDiscountAmount(-100, 'percent', 100)).toBe(0);
  });

  it('very large negative discount => 0', () => {
    expect(calculateDiscountAmount(1000, 'percent', -999999)).toBe(0);
  });

  it('very large negative subtotal => 0', () => {
    expect(calculateDiscountAmount(-999999, 'amount', 100)).toBe(0);
  });

  it('-0 subtotal (percent) => 0', () => {
    expect(calculateDiscountAmount(-0, 'percent', 50)).toBe(0);
  });

  it('-0 discount value (amount) => 0', () => {
    expect(calculateDiscountAmount(1000, 'amount', -0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 6. NaN / undefined / null edge cases
// ---------------------------------------------------------------------------
describe('calculateDiscountAmount — NaN/undefined/null coercion', () => {
  it('NaN discount value (percent) => 0', () => {
    expect(calculateDiscountAmount(1000, 'percent', NaN)).toBe(0);
  });

  it('NaN discount value (amount) => 0', () => {
    expect(calculateDiscountAmount(1000, 'amount', NaN)).toBe(0);
  });

  it('NaN subtotal (percent) => 0', () => {
    expect(calculateDiscountAmount(NaN, 'percent', 10)).toBe(0);
  });

  it('NaN subtotal (amount) => 0', () => {
    expect(calculateDiscountAmount(NaN, 'amount', 100)).toBe(0);
  });

  it('both NaN => 0', () => {
    expect(calculateDiscountAmount(NaN, 'percent', NaN)).toBe(0);
  });

  // The function signature takes `number`, but JS callers may pass these at runtime.
  // TypeScript won't catch it, so we test the runtime behavior.
  it('undefined discount value coerced via || 0 (percent) => 0', () => {
    expect(calculateDiscountAmount(1000, 'percent', undefined as unknown as number)).toBe(0);
  });

  it('undefined discount value coerced via || 0 (amount) => 0', () => {
    expect(calculateDiscountAmount(1000, 'amount', undefined as unknown as number)).toBe(0);
  });

  it('null discount value coerced via || 0 (percent) => 0', () => {
    expect(calculateDiscountAmount(1000, 'percent', null as unknown as number)).toBe(0);
  });

  it('null discount value coerced via || 0 (amount) => 0', () => {
    expect(calculateDiscountAmount(1000, 'amount', null as unknown as number)).toBe(0);
  });

  it('undefined subtotal coerced via || 0 (percent) => 0', () => {
    expect(calculateDiscountAmount(undefined as unknown as number, 'percent', 50)).toBe(0);
  });

  it('null subtotal coerced via || 0 (amount) => 0', () => {
    expect(calculateDiscountAmount(null as unknown as number, 'amount', 100)).toBe(0);
  });

  it('Infinity subtotal treated as 0 by round2', () => {
    // Infinity || 0 => Infinity, but Math.max(0, Infinity) => Infinity
    // round2(Infinity * 0.1) => round2(Infinity) => 0 (isFinite check)
    expect(calculateDiscountAmount(Infinity, 'percent', 10)).toBe(0);
  });

  it('Infinity discount (amount) clamped to subtotal via min', () => {
    // Math.max(0, Infinity) => Infinity, Math.min(subtotal, Infinity) => subtotal
    expect(calculateDiscountAmount(500, 'amount', Infinity)).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// 7. Floating-point precision
// ---------------------------------------------------------------------------
describe('calculateDiscountAmount — floating-point precision', () => {
  it('33.33% of 100 => 33.33', () => {
    expect(calculateDiscountAmount(100, 'percent', 33.33)).toBe(33.33);
  });

  it('33.33% of 100.01 => 33.34 (rounded)', () => {
    // 100.01 * 0.3333 = 33.333333... => round2 => 33.33
    const result = calculateDiscountAmount(100.01, 'percent', 33.33);
    expect(result).toBe(33.33);
  });

  it('66.67% of 100 => 66.67', () => {
    expect(calculateDiscountAmount(100, 'percent', 66.67)).toBe(66.67);
  });

  it('33.33% of 99.99 => 33.33', () => {
    const result = calculateDiscountAmount(99.99, 'percent', 33.33);
    // 99.99 * 0.3333 = 33.326667 => round2 => 33.33
    expect(result).toBe(33.33);
  });

  it('7% of 0.99 => 0.07', () => {
    expect(calculateDiscountAmount(0.99, 'percent', 7)).toBe(0.07);
  });

  it('amount 99.995 on subtotal 1000 => 100.00 (round2)', () => {
    expect(calculateDiscountAmount(1000, 'amount', 99.995)).toBe(100);
  });

  it('amount 99.994 on subtotal 1000 => 99.99', () => {
    expect(calculateDiscountAmount(1000, 'amount', 99.994)).toBe(99.99);
  });

  it('15.5% of 333.33 => 51.67', () => {
    // 333.33 * 0.155 = 51.66615 => round2 => 51.67
    expect(calculateDiscountAmount(333.33, 'percent', 15.5)).toBe(51.67);
  });

  it('0.5% of 0.01 => 0 (below precision)', () => {
    // 0.01 * 0.005 = 0.00005 => round2 => 0
    expect(calculateDiscountAmount(0.01, 'percent', 0.5)).toBe(0);
  });

  it('12.345% of 1000 => 123.45', () => {
    expect(calculateDiscountAmount(1000, 'percent', 12.345)).toBe(123.45);
  });

  it('99.99% of 100 => 99.99', () => {
    expect(calculateDiscountAmount(100, 'percent', 99.99)).toBe(99.99);
  });

  it('99.999% of 100 => 100 (round2)', () => {
    // 100 * 0.99999 = 99.999 => round2 => 100
    expect(calculateDiscountAmount(100, 'percent', 99.999)).toBe(100);
  });

  it('amount with many decimal places: 123.456789 on 1000 => 123.46', () => {
    expect(calculateDiscountAmount(1000, 'amount', 123.456789)).toBe(123.46);
  });

  it('amount 0.004 rounds to 0', () => {
    expect(calculateDiscountAmount(1000, 'amount', 0.004)).toBe(0);
  });

  it('3.33% of 3.33 => 0.11', () => {
    // 3.33 * 0.0333 = 0.110889 => round2 => 0.11
    expect(calculateDiscountAmount(3.33, 'percent', 3.33)).toBe(0.11);
  });
});

// ---------------------------------------------------------------------------
// 8. Systematic table-driven tests
// ---------------------------------------------------------------------------
describe('calculateDiscountAmount — table-driven', () => {
  const cases: Array<{
    label: string;
    subtotal: number;
    type: 'percent' | 'amount';
    value: number;
    expected: number;
  }> = [
    // Percent normal
    { label: '10% of 100', subtotal: 100, type: 'percent', value: 10, expected: 10 },
    { label: '20% of 250', subtotal: 250, type: 'percent', value: 20, expected: 50 },
    { label: '50% of 1', subtotal: 1, type: 'percent', value: 50, expected: 0.5 },
    { label: '100% of 0.5', subtotal: 0.5, type: 'percent', value: 100, expected: 0.5 },
    { label: '0.1% of 10000', subtotal: 10000, type: 'percent', value: 0.1, expected: 10 },
    // Percent clamped
    { label: '110% of 100 clamped', subtotal: 100, type: 'percent', value: 110, expected: 100 },
    { label: '500% of 10 clamped', subtotal: 10, type: 'percent', value: 500, expected: 10 },
    // Percent zero
    { label: '0% of 999', subtotal: 999, type: 'percent', value: 0, expected: 0 },
    // Amount normal
    { label: 'amt 10 on 100', subtotal: 100, type: 'amount', value: 10, expected: 10 },
    { label: 'amt 250.50 on 1000', subtotal: 1000, type: 'amount', value: 250.5, expected: 250.5 },
    // Amount clamped
    { label: 'amt 200 on 100 clamped', subtotal: 100, type: 'amount', value: 200, expected: 100 },
    {
      label: 'amt 0.02 on 0.01 clamped',
      subtotal: 0.01,
      type: 'amount',
      value: 0.02,
      expected: 0.01,
    },
    // Negatives
    { label: 'neg value percent', subtotal: 100, type: 'percent', value: -5, expected: 0 },
    { label: 'neg subtotal amount', subtotal: -100, type: 'amount', value: 50, expected: 0 },
    { label: 'neg both', subtotal: -100, type: 'percent', value: -10, expected: 0 },
    // NaN
    { label: 'NaN subtotal percent', subtotal: NaN, type: 'percent', value: 10, expected: 0 },
    { label: 'NaN value amount', subtotal: 100, type: 'amount', value: NaN, expected: 0 },
  ];

  for (const c of cases) {
    it(c.label, () => {
      expect(calculateDiscountAmount(c.subtotal, c.type, c.value)).toBe(c.expected);
    });
  }
});

// ---------------------------------------------------------------------------
// 9. Property-based fuzz (500+ random combinations)
// ---------------------------------------------------------------------------
describe('calculateDiscountAmount — property-based fuzz (500+ iterations)', () => {
  const SEED = 20260617; // deterministic seed: today's date
  const ITERATIONS = 600;
  const rand = mulberry32(SEED);

  // Helper to generate a random number in a range
  const randRange = (min: number, max: number) => min + rand() * (max - min);

  // Pre-generate all test inputs for deterministic behavior
  const testInputs = Array.from({ length: ITERATIONS }, (_, i) => {
    const subtotal = randRange(-100, 50000);
    const discountValue = randRange(-100, 500);
    const discountType: 'percent' | 'amount' = rand() > 0.5 ? 'percent' : 'amount';
    return { index: i, subtotal, discountValue, discountType };
  });

  describe('invariant: result is always >= 0', () => {
    it(`holds for all ${ITERATIONS} random inputs`, () => {
      for (const { subtotal, discountValue, discountType } of testInputs) {
        const result = calculateDiscountAmount(subtotal, discountType, discountValue);
        expect(result).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('invariant: result <= max(0, subtotal)', () => {
    it(`holds for all ${ITERATIONS} random inputs`, () => {
      for (const { subtotal, discountValue, discountType } of testInputs) {
        const result = calculateDiscountAmount(subtotal, discountType, discountValue);
        const safeSubtotal = Math.max(0, subtotal || 0);
        // result may equal round2(safeSubtotal) which could be slightly above due to
        // EPSILON rounding, but never more than 0.01 above safeSubtotal
        expect(result).toBeLessThanOrEqual(round2(safeSubtotal) + 0.01);
      }
    });
  });

  describe('invariant: percent type matches formula', () => {
    it('result = round2(safeSubtotal * min(100, safeValue) / 100)', () => {
      for (const { subtotal, discountValue, discountType } of testInputs) {
        if (discountType !== 'percent') continue;
        const safeValue = Math.max(0, discountValue || 0);
        const safeSubtotal = Math.max(0, subtotal || 0);
        const expected = round2(safeSubtotal * (Math.min(100, safeValue) / 100));
        const result = calculateDiscountAmount(subtotal, discountType, discountValue);
        expect(result).toBe(expected);
      }
    });
  });

  describe('invariant: amount type matches formula', () => {
    it('result = round2(min(safeSubtotal, safeValue))', () => {
      for (const { subtotal, discountValue, discountType } of testInputs) {
        if (discountType !== 'amount') continue;
        const safeValue = Math.max(0, discountValue || 0);
        const safeSubtotal = Math.max(0, subtotal || 0);
        const expected = round2(Math.min(safeSubtotal, safeValue));
        const result = calculateDiscountAmount(subtotal, discountType, discountValue);
        expect(result).toBe(expected);
      }
    });
  });

  describe('invariant: result has at most 2 decimal places', () => {
    it(`holds for all ${ITERATIONS} random inputs`, () => {
      for (const { subtotal, discountValue, discountType } of testInputs) {
        const result = calculateDiscountAmount(subtotal, discountType, discountValue);
        // Multiply by 100, should be integer (or very close due to floating point)
        const scaled = result * 100;
        expect(Math.abs(scaled - Math.round(scaled))).toBeLessThan(1e-9);
      }
    });
  });

  describe('invariant: result is a finite number', () => {
    it(`holds for all ${ITERATIONS} random inputs`, () => {
      for (const { subtotal, discountValue, discountType } of testInputs) {
        const result = calculateDiscountAmount(subtotal, discountType, discountValue);
        expect(Number.isFinite(result)).toBe(true);
      }
    });
  });

  // Focused fuzz: only large values to stress clamping
  describe('stress: large values', () => {
    const largeInputs = Array.from({ length: 100 }, () => ({
      subtotal: randRange(0, 1_000_000),
      discountValue: randRange(0, 2_000_000),
      discountType: (rand() > 0.5 ? 'percent' : 'amount') as 'percent' | 'amount',
    }));

    it('large amounts always clamp to subtotal', () => {
      for (const { subtotal, discountValue, discountType } of largeInputs) {
        if (discountType !== 'amount') continue;
        const result = calculateDiscountAmount(subtotal, discountType, discountValue);
        expect(result).toBeLessThanOrEqual(round2(subtotal) + 0.01);
        expect(result).toBeGreaterThanOrEqual(0);
      }
    });

    it('large percents always clamp to 100% of subtotal', () => {
      for (const { subtotal, discountValue, discountType } of largeInputs) {
        if (discountType !== 'percent') continue;
        const result = calculateDiscountAmount(subtotal, discountType, discountValue);
        expect(result).toBeLessThanOrEqual(round2(subtotal) + 0.01);
        expect(result).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // Focused fuzz: zero and near-zero
  describe('stress: near-zero values', () => {
    const nearZeroInputs = Array.from({ length: 50 }, () => ({
      subtotal: randRange(-0.01, 0.1),
      discountValue: randRange(-0.01, 0.1),
      discountType: (rand() > 0.5 ? 'percent' : 'amount') as 'percent' | 'amount',
    }));

    it('near-zero inputs never produce negative result', () => {
      for (const { subtotal, discountValue, discountType } of nearZeroInputs) {
        const result = calculateDiscountAmount(subtotal, discountType, discountValue);
        expect(result).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
