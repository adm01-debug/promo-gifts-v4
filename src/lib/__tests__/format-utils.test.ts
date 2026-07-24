import { describe, it, expect } from 'vitest';
import { formatTooltipNumber, formatTooltipPercent, formatTooltipCurrency } from '../format-utils';

describe('format-utils', () => {
  describe('formatTooltipNumber', () => {
    it('should format numbers to pt-BR', () => {
      expect(formatTooltipNumber(1234.56, 1)).toBe('1.234,6');
      expect(formatTooltipNumber(0)).toBe('0');
      expect(formatTooltipNumber(1000000)).toBe('1.000.000');
    });

    it('should return "Sem dados" for empty/null values', () => {
      expect(formatTooltipNumber(null)).toBe('Sem dados');
      expect(formatTooltipNumber(undefined)).toBe('Sem dados');
      expect(formatTooltipNumber(NaN)).toBe('Sem dados');
    });

    it('should handle decimal places', () => {
      expect(formatTooltipNumber(10.1234, 2)).toBe('10,12');
      expect(formatTooltipNumber(10.1234, 0)).toBe('10');
      expect(formatTooltipNumber(99.9999, 1)).toBe('100,0');
    });

    it('should handle very large numbers', () => {
      expect(formatTooltipNumber(999999999.49)).toBe('999.999.999');
      expect(formatTooltipNumber(1234567890)).toBe('1.234.567.890');
    });

    it('should handle long decimals by rounding', () => {
      expect(formatTooltipNumber(1.23456789, 4)).toBe('1,2346');
    });
  });

  describe('formatTooltipPercent', () => {
    it('should add + sign for positive numbers', () => {
      expect(formatTooltipPercent(15)).toBe('+15%');
    });

    it('should show - sign for negative numbers', () => {
      expect(formatTooltipPercent(-10)).toBe('-10%');
    });

    it('should return "Sem dados" for invalid values', () => {
      expect(formatTooltipPercent(null)).toBe('Sem dados');
    });
  });

  describe('formatTooltipCurrency', () => {
    it('should format BRL correctly', () => {
      // Use a regex or check for parts because of non-breaking spaces in some envs
      const result = formatTooltipCurrency(1234.5);
      expect(result).toContain('R$');
      expect(result).toContain('1.234,50');
    });

    it('should return "Sem dados" for invalid values', () => {
      expect(formatTooltipCurrency(undefined)).toBe('Sem dados');
    });
  });
});
