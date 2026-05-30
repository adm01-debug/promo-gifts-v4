import { describe, it, expect } from 'vitest';
import { formatTooltipNumber, formatTooltipPercent, formatTooltipCurrency } from '../format-utils';

describe('Format Utils (Tooltips)', () => {
  it('should format numbers correctly to pt-BR', () => {
    expect(formatTooltipNumber(1234.56, 1)).toBe('1.234,6');
    expect(formatTooltipNumber(0, 0)).toBe('0');
  });

  it('should handle large numbers', () => {
    expect(formatTooltipNumber(1000000)).toBe('1.000.000');
  });

  it('should return "Sem dados" for empty values', () => {
    expect(formatTooltipNumber(null)).toBe('Sem dados');
    expect(formatTooltipNumber(undefined)).toBe('Sem dados');
    expect(formatTooltipNumber(NaN)).toBe('Sem dados');
  });

  it('should format percentages with signs', () => {
    expect(formatTooltipPercent(25.4)).toBe('+25%');
    expect(formatTooltipPercent(-10, 1)).toBe('-10,0%');
    expect(formatTooltipPercent(0)).toBe('+0%');
  });

  it('should format currency in R$', () => {
    // Note: Vitest/Node environment might have subtle differences in whitespace for currency 
    // but the core "R$" and comma should be present.
    const result = formatTooltipCurrency(1500.50);
    expect(result).toContain('R$');
    expect(result).toContain('1.500,50');
  });
});
