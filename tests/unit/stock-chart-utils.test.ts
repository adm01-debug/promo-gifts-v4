/**
 * Unit tests for pure helpers in src/lib/stock-chart-utils.ts
 *
 * seededRandom, hashCode, safeVelocityTrend, safeNumber,
 * safePriceChanges, formatVelocityTrendOperational, formatVelocityTrendCommercial
 */
import { describe, it, expect } from 'vitest';
import {
  seededRandom,
  hashCode,
  safeVelocityTrend,
  safeNumber,
  safePriceChanges,
  formatVelocityTrendOperational,
  formatVelocityTrendCommercial,
} from '@/lib/stock-chart-utils';

// ============================================
// seededRandom
// ============================================

describe('seededRandom', () => {
  it('returns a value in [0, 1)', () => {
    for (let i = 0; i < 20; i++) {
      const v = seededRandom(i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic: same seed produces same result', () => {
    expect(seededRandom(42)).toBe(seededRandom(42));
    expect(seededRandom(0)).toBe(seededRandom(0));
  });

  it('different seeds produce different results (most of the time)', () => {
    const values = new Set([seededRandom(1), seededRandom(2), seededRandom(3)]);
    expect(values.size).toBeGreaterThan(1);
  });
});

// ============================================
// hashCode
// ============================================

describe('hashCode', () => {
  it('returns 0 for empty string', () => {
    expect(hashCode('')).toBe(0);
  });

  it('returns a non-negative integer', () => {
    expect(hashCode('hello')).toBeGreaterThanOrEqual(0);
    expect(hashCode('abc123')).toBeGreaterThanOrEqual(0);
  });

  it('is deterministic for the same input', () => {
    expect(hashCode('test')).toBe(hashCode('test'));
    expect(hashCode('promo-brindes')).toBe(hashCode('promo-brindes'));
  });

  it('produces different values for different strings', () => {
    const h1 = hashCode('product-1');
    const h2 = hashCode('product-2');
    expect(h1).not.toBe(h2);
  });

  it('handles UUID-like strings', () => {
    const uuid = 'a3bb189e-8bf9-3888-9f83-77b2bcf6e3fb';
    expect(hashCode(uuid)).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(hashCode(uuid))).toBe(true);
  });
});

// ============================================
// safeVelocityTrend
// ============================================

describe('safeVelocityTrend', () => {
  it('returns null for null', () => {
    expect(safeVelocityTrend(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(safeVelocityTrend(undefined)).toBeNull();
  });

  it('returns null for NaN', () => {
    expect(safeVelocityTrend(NaN)).toBeNull();
  });

  it('returns null for Infinity', () => {
    expect(safeVelocityTrend(Infinity)).toBeNull();
    expect(safeVelocityTrend(-Infinity)).toBeNull();
  });

  it('returns the value for valid finite numbers', () => {
    expect(safeVelocityTrend(1.5)).toBe(1.5);
    expect(safeVelocityTrend(0)).toBe(0);
    expect(safeVelocityTrend(-3.2)).toBe(-3.2);
  });
});

// ============================================
// safeNumber
// ============================================

describe('safeNumber', () => {
  it('returns null for null', () => {
    expect(safeNumber(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(safeNumber(undefined)).toBeNull();
  });

  it('returns null for NaN', () => {
    expect(safeNumber(NaN)).toBeNull();
  });

  it('returns null for Infinity', () => {
    expect(safeNumber(Infinity)).toBeNull();
  });

  it('returns finite numbers unchanged', () => {
    expect(safeNumber(42)).toBe(42);
    expect(safeNumber(0)).toBe(0);
    expect(safeNumber(-7.5)).toBe(-7.5);
  });
});

// ============================================
// safePriceChanges
// ============================================

describe('safePriceChanges', () => {
  it('returns 0 for null', () => {
    expect(safePriceChanges(null)).toBe(0);
  });

  it('returns 0 for non-object', () => {
    expect(safePriceChanges(42)).toBe(0);
    expect(safePriceChanges('string')).toBe(0);
  });

  it('returns 0 when price_changes_30d is missing', () => {
    expect(safePriceChanges({})).toBe(0);
    expect(safePriceChanges({ other: 5 })).toBe(0);
  });

  it('returns 0 when price_changes_30d is NaN', () => {
    expect(safePriceChanges({ price_changes_30d: NaN })).toBe(0);
  });

  it('returns 0 when price_changes_30d is a string', () => {
    expect(safePriceChanges({ price_changes_30d: '3' })).toBe(0);
  });

  it('returns the numeric value when present and finite', () => {
    expect(safePriceChanges({ price_changes_30d: 3 })).toBe(3);
    expect(safePriceChanges({ price_changes_30d: 0 })).toBe(0);
  });
});

// ============================================
// formatVelocityTrendOperational
// ============================================

describe('formatVelocityTrendOperational', () => {
  it('returns dash for null trend', () => {
    const r = formatVelocityTrendOperational(null);
    expect(r.value).toBe('—');
    expect(r.label).toBe('');
  });

  it('returns dash for non-finite (Infinity)', () => {
    const r = formatVelocityTrendOperational(Infinity);
    expect(r.value).toBe('—');
  });

  it('labels > 1.5 as "acelerando!"', () => {
    const r = formatVelocityTrendOperational(2.0);
    expect(r.label).toBe('acelerando!');
    expect(r.value).toBe('+100%');
  });

  it('labels between 1 and 1.5 as "crescendo"', () => {
    const r = formatVelocityTrendOperational(1.2);
    expect(r.label).toBe('crescendo');
    expect(r.value).toBe('+20%');
  });

  it('labels between 0.5 and 1 as "desacelerando"', () => {
    const r = formatVelocityTrendOperational(0.8);
    expect(r.label).toBe('desacelerando');
  });

  it('labels <= 0.5 as "caindo"', () => {
    const r = formatVelocityTrendOperational(0.3);
    expect(r.label).toBe('caindo');
  });

  it('formats percentage correctly for negative change', () => {
    const r = formatVelocityTrendOperational(0.5);
    expect(r.value).toBe('-50%');
  });
});

// ============================================
// formatVelocityTrendCommercial
// ============================================

describe('formatVelocityTrendCommercial', () => {
  it('returns dash for null', () => {
    const r = formatVelocityTrendCommercial(null);
    expect(r.value).toBe('—');
    expect(r.sub).toBe('');
    expect(r.isPositive).toBe(false);
  });

  it('sets isPositive=true when trend > 1', () => {
    expect(formatVelocityTrendCommercial(1.1).isPositive).toBe(true);
  });

  it('sets isPositive=false when trend <= 1', () => {
    expect(formatVelocityTrendCommercial(1.0).isPositive).toBe(false);
    expect(formatVelocityTrendCommercial(0.8).isPositive).toBe(false);
  });

  it('labels > 1.5 as "acelerando forte!"', () => {
    const r = formatVelocityTrendCommercial(1.6);
    expect(r.sub).toBe('acelerando forte!');
  });

  it('labels > 1 as "demanda crescente"', () => {
    const r = formatVelocityTrendCommercial(1.2);
    expect(r.sub).toBe('demanda crescente');
  });

  it('labels > 0.5 as "desacelerando"', () => {
    const r = formatVelocityTrendCommercial(0.7);
    expect(r.sub).toBe('desacelerando');
  });

  it('labels <= 0.5 as "queda de interesse"', () => {
    const r = formatVelocityTrendCommercial(0.4);
    expect(r.sub).toBe('queda de interesse');
  });

  it('formats percentage with + prefix for growth', () => {
    const r = formatVelocityTrendCommercial(1.5);
    expect(r.value).toBe('+50%');
  });
});
