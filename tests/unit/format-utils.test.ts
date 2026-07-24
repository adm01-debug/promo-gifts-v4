/**
 * Unit tests for src/lib/format-utils.ts
 *
 * formatTooltipNumber, formatTooltipPercent, formatTooltipCurrency
 */
import { describe, it, expect } from 'vitest';
import {
  formatTooltipNumber,
  formatTooltipPercent,
  formatTooltipCurrency,
} from '@/lib/format-utils';

// ============================================
// formatTooltipNumber
// ============================================

describe('formatTooltipNumber', () => {
  it('returns "Sem dados" for undefined', () => {
    expect(formatTooltipNumber(undefined)).toBe('Sem dados');
  });

  it('returns "Sem dados" for null', () => {
    expect(formatTooltipNumber(null)).toBe('Sem dados');
  });

  it('returns "Sem dados" for NaN', () => {
    expect(formatTooltipNumber(NaN)).toBe('Sem dados');
  });

  it('formats zero as "0" (no decimals)', () => {
    expect(formatTooltipNumber(0)).toBe('0');
  });

  it('formats integer 1000 with pt-BR thousands separator', () => {
    const result = formatTooltipNumber(1000);
    expect(result).toContain('1');
    expect(result).toContain('000');
    // PT-BR uses '.' as thousands separator
    expect(result).toBe('1.000');
  });

  it('formats negative number', () => {
    const result = formatTooltipNumber(-500);
    expect(result).toContain('500');
    expect(result.startsWith('-')).toBe(true);
  });

  it('formats decimal with 2 places', () => {
    const result = formatTooltipNumber(1234.5, 2);
    expect(result).toContain('1.234');
    expect(result).toContain(',50');
  });

  it('rounds to 0 decimal by default', () => {
    const result = formatTooltipNumber(99.9);
    // Should round to "100"
    expect(result).toBe('100');
  });

  it('formats large number', () => {
    const result = formatTooltipNumber(1000000);
    expect(result).toContain('1');
    expect(result).toContain('000');
  });

  it('decimal with 1 place', () => {
    const result = formatTooltipNumber(3.14159, 1);
    expect(result).toContain('3');
  });
});

// ============================================
// formatTooltipPercent
// ============================================

describe('formatTooltipPercent', () => {
  it('returns "Sem dados" for undefined', () => {
    expect(formatTooltipPercent(undefined)).toBe('Sem dados');
  });

  it('returns "Sem dados" for null', () => {
    expect(formatTooltipPercent(null)).toBe('Sem dados');
  });

  it('returns "Sem dados" for NaN', () => {
    expect(formatTooltipPercent(NaN)).toBe('Sem dados');
  });

  it('prepends "+" for positive value', () => {
    expect(formatTooltipPercent(10)).toBe('+10%');
  });

  it('prepends "+" for zero', () => {
    expect(formatTooltipPercent(0)).toBe('+0%');
  });

  it('no "+" prefix for negative value', () => {
    const result = formatTooltipPercent(-5);
    expect(result.startsWith('+')).toBe(false);
    expect(result).toContain('5');
    expect(result).toContain('%');
  });

  it('formats negative percent correctly', () => {
    expect(formatTooltipPercent(-10)).toBe('-10%');
  });

  it('formats with 2 decimal places', () => {
    const result = formatTooltipPercent(10.5, 2);
    expect(result).toContain('+');
    expect(result).toContain('10');
    expect(result.endsWith('%')).toBe(true);
  });

  it('appends "%" suffix', () => {
    expect(formatTooltipPercent(42).endsWith('%')).toBe(true);
    expect(formatTooltipPercent(-42).endsWith('%')).toBe(true);
  });
});

// ============================================
// formatTooltipCurrency
// ============================================

describe('formatTooltipCurrency', () => {
  it('returns "Sem dados" for undefined', () => {
    expect(formatTooltipCurrency(undefined)).toBe('Sem dados');
  });

  it('returns "Sem dados" for null', () => {
    expect(formatTooltipCurrency(null)).toBe('Sem dados');
  });

  it('returns "Sem dados" for NaN', () => {
    expect(formatTooltipCurrency(NaN)).toBe('Sem dados');
  });

  it('includes "R$" currency symbol', () => {
    expect(formatTooltipCurrency(100)).toContain('R$');
  });

  it('formats zero with two decimal places in BRL', () => {
    const result = formatTooltipCurrency(0);
    expect(result).toContain('R$');
    expect(result).toContain('0,00');
  });

  it('formats 1500 with thousands separator and decimals', () => {
    const result = formatTooltipCurrency(1500);
    expect(result).toContain('R$');
    expect(result).toContain('1.500');
    expect(result).toContain(',00');
  });

  it('formats negative amount', () => {
    const result = formatTooltipCurrency(-100);
    expect(result).toContain('R$');
    expect(result).toContain('100');
  });

  it('formats fractional amount', () => {
    const result = formatTooltipCurrency(9.99);
    expect(result).toContain('R$');
    expect(result).toContain('9,99');
  });
});
