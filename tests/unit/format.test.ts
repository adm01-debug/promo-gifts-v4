/**
 * Unit tests for src/lib/format.ts
 *
 * formatCurrency / formatCurrencyCompact / formatUnitPrice / round2
 */
import { describe, it, expect } from 'vitest';
import { formatCurrency, formatCurrencyCompact, formatUnitPrice, round2 } from '@/lib/format';

describe('formatCurrency', () => {
  it('formats zero with two decimal places', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0,00');
    expect(result).toContain('R$');
  });

  it('formats a positive integer', () => {
    const result = formatCurrency(1000);
    expect(result).toContain('1.000,00');
  });

  it('formats decimal values with exactly 2 fractional digits', () => {
    expect(formatCurrency(9.9)).toContain('9,90');
    expect(formatCurrency(99.99)).toContain('99,99');
  });

  it('formats large values with thousands separator', () => {
    expect(formatCurrency(1234567.89)).toContain('1.234.567,89');
  });

  it('formats negative values', () => {
    const result = formatCurrency(-50.5);
    expect(result).toContain('50,50');
  });
});

describe('formatCurrencyCompact', () => {
  it('omits decimal places', () => {
    const result = formatCurrencyCompact(1000);
    expect(result).toContain('1.000');
    expect(result).not.toContain(',00');
  });

  it('rounds to nearest integer', () => {
    const result = formatCurrencyCompact(9.7);
    expect(result).toContain('10');
  });

  it('still includes R$ currency symbol', () => {
    expect(formatCurrencyCompact(50)).toContain('R$');
  });
});

describe('formatUnitPrice', () => {
  it('appends /un suffix', () => {
    const result = formatUnitPrice(25);
    expect(result).toContain('/un');
    expect(result).toContain('25,00');
    expect(result).toContain('R$');
  });
});

describe('round2', () => {
  it('rounds to 2 decimal places (half-up)', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(1.004)).toBe(1.0);
    expect(round2(1.255)).toBe(1.26);
  });

  it('returns 0 for null', () => {
    expect(round2(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(round2(undefined)).toBe(0);
  });

  it('returns 0 for NaN', () => {
    expect(round2(NaN)).toBe(0);
  });

  it('returns 0 for Infinity', () => {
    expect(round2(Infinity)).toBe(0);
    expect(round2(-Infinity)).toBe(0);
  });

  it('returns the value unchanged when already 2 decimals', () => {
    expect(round2(1.23)).toBe(1.23);
    expect(round2(0.01)).toBe(0.01);
  });

  it('handles zero', () => {
    expect(round2(0)).toBe(0);
  });

  it('handles negative values', () => {
    expect(round2(-1.005)).toBeCloseTo(-1.0, 2);
    expect(round2(-9.99)).toBe(-9.99);
  });
});
