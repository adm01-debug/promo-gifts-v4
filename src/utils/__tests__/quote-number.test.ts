import { describe, it, expect } from 'vitest';
import {
  formatQuoteNumberLabel,
  computeNextQuoteNumberPreview,
  QUOTE_NUMBER_REGEX,
} from '../quote-number';

describe('formatQuoteNumberLabel', () => {
  it('aceita formato canônico NNNNN/YY', () => {
    expect(formatQuoteNumberLabel('10010/26')).toBe('10010/26');
    expect(formatQuoteNumberLabel(' 10010/26 ')).toBe('10010/26');
    expect(formatQuoteNumberLabel('123/26')).toBe('123/26');
  });

  it('retorna null para valores ausentes/vazios (modo criação)', () => {
    expect(formatQuoteNumberLabel(null)).toBeNull();
    expect(formatQuoteNumberLabel(undefined)).toBeNull();
    expect(formatQuoteNumberLabel('')).toBeNull();
    expect(formatQuoteNumberLabel('   ')).toBeNull();
  });

  it('rejeita formatos não canônicos', () => {
    expect(formatQuoteNumberLabel('ORC-2026-0001')).toBeNull();
    expect(formatQuoteNumberLabel('10010-26')).toBeNull();
    expect(formatQuoteNumberLabel('10010/2026')).toBeNull();
    expect(formatQuoteNumberLabel('abc/yy')).toBeNull();
  });

  it('regex exportada bate com o formato', () => {
    expect(QUOTE_NUMBER_REGEX.test('10010/26')).toBe(true);
    expect(QUOTE_NUMBER_REGEX.test('1/26')).toBe(false);
  });
});

describe('computeNextQuoteNumberPreview', () => {
  it('retorna ~max+1/YY do ano corrente', () => {
    expect(
      computeNextQuoteNumberPreview(['10008/26', '10010/26', '10009/26'], 2026),
    ).toBe('~10011/26');
  });

  it('ignora anos diferentes', () => {
    expect(computeNextQuoteNumberPreview(['9999/25', '10000/25'], 2026)).toBeNull();
  });

  it('ignora entradas inválidas', () => {
    expect(
      computeNextQuoteNumberPreview([null, undefined, 'lixo', '10010/26'], 2026),
    ).toBe('~10011/26');
  });

  it('retorna null quando não há histórico', () => {
    expect(computeNextQuoteNumberPreview([], 2026)).toBeNull();
  });
});
