/**
 * Unit — Cobertura exaustiva de validação/normalização do quote_number.
 * Garante:
 *  - formato canônico `NNNNN/YY` (3-6 dígitos / 2 dígitos do ano)
 *  - sanitização de espaços
 *  - rejeição de null/undefined/vazio/malformados
 *  - normalização determinística (idempotente)
 */
import { describe, it, expect } from 'vitest';
import {
  formatQuoteNumberLabel,
  computeNextQuoteNumberPreview,
  QUOTE_NUMBER_REGEX,
} from '@/utils/quote-number';

describe('quote-number · normalização e validação exaustivas', () => {
  describe('idempotência', () => {
    it.each(['10010/26', '123/26', '999999/99'])(
      'normalizar(%s) é idempotente',
      (input) => {
        const first = formatQuoteNumberLabel(input);
        const second = formatQuoteNumberLabel(first);
        expect(first).toBe(second);
        expect(first).toBe(input);
      },
    );
  });

  describe('saneamento de espaços', () => {
    it.each([
      ['  10010/26', '10010/26'],
      ['10010/26  ', '10010/26'],
      ['\t10010/26\n', '10010/26'],
      ['1 0 0 1 0 / 2 6', '10010/26'],
    ])('remove whitespace: %j → %s', (input, expected) => {
      expect(formatQuoteNumberLabel(input)).toBe(expected);
    });
  });

  describe('limites do formato NNNNN/YY', () => {
    it('aceita seq mínimo (3 dígitos) e máximo (6 dígitos)', () => {
      expect(formatQuoteNumberLabel('100/26')).toBe('100/26');
      expect(formatQuoteNumberLabel('999999/26')).toBe('999999/26');
    });
    it('rejeita seq fora dos limites', () => {
      expect(formatQuoteNumberLabel('99/26')).toBeNull();
      expect(formatQuoteNumberLabel('1234567/26')).toBeNull();
    });
    it('exige exatamente 2 dígitos no ano', () => {
      expect(formatQuoteNumberLabel('10010/2')).toBeNull();
      expect(formatQuoteNumberLabel('10010/226')).toBeNull();
      expect(formatQuoteNumberLabel('10010/2026')).toBeNull();
    });
  });

  describe('valores ausentes (modo Novo/Rascunho)', () => {
    it.each([null, undefined, '', '   ', '\n\t'])(
      'retorna null para %j (UI deve usar fallback amigável)',
      (input) => {
        expect(formatQuoteNumberLabel(input as null | undefined | string)).toBeNull();
      },
    );
  });

  describe('malformados (corrupção / formato legado)', () => {
    it.each([
      'ORC-2026-0001',
      '10010-26',
      '10010_26',
      '10010 26',
      'abc/26',
      '10010/yy',
      '/26',
      '10010/',
      '10010//26',
      '10010/26/extra',
      '-10010/26',
      '10010/-26',
    ])('rejeita %j', (input) => {
      expect(formatQuoteNumberLabel(input)).toBeNull();
    });
  });

  describe('regex exportada como SSOT', () => {
    it('bate com todos os formatos canônicos válidos', () => {
      expect(QUOTE_NUMBER_REGEX.test('100/26')).toBe(true);
      expect(QUOTE_NUMBER_REGEX.test('999999/99')).toBe(true);
    });
  });

  describe('prévia de próximo número', () => {
    it('lista mista (válidos + nulos + lixo + anos diversos)', () => {
      expect(
        computeNextQuoteNumberPreview(
          [null, undefined, '', 'lixo', '9999/25', '10010/26', '10009/26', 'ORC-2026-0001'],
          2026,
        ),
      ).toBe('~10011/26');
    });
    it('virada de ano: ano sem orçamentos → null', () => {
      expect(computeNextQuoteNumberPreview(['10010/26'], 2027)).toBeNull();
    });
  });
});
