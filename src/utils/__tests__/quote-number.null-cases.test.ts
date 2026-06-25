/**
 * Unit — Validação client-side do quote_number em modos de criação.
 * Cobre null, undefined, vazio, malformado e formato canônico NNNNN/YY.
 */
import { describe, it, expect } from 'vitest';
import { formatQuoteNumberLabel, QUOTE_NUMBER_REGEX } from '@/utils/quote-number';

describe('quote_number · null/undefined em modos Novo e Rascunho', () => {
  it.each([null, undefined, '', '   '])(
    'retorna null para valor ausente (%p) — UI deve mostrar fallback',
    (input) => {
      expect(formatQuoteNumberLabel(input as null | undefined | string)).toBeNull();
    },
  );

  it.each([
    ['10010/26', '10010/26'],
    [' 10010/26 ', '10010/26'],
    ['123/26', '123/26'],
    ['999999/99', '999999/99'],
  ])('aceita formato canônico NNNNN/YY: %s → %s', (input, expected) => {
    expect(formatQuoteNumberLabel(input)).toBe(expected);
    expect(QUOTE_NUMBER_REGEX.test(expected)).toBe(true);
  });

  it.each(['ORC-2026-0001', '10010-26', '10010/2026', 'abc/yy', '12/26', '/26', '10010/'])(
    'rejeita formato não canônico: %s',
    (input) => {
      expect(formatQuoteNumberLabel(input)).toBeNull();
    },
  );
});
