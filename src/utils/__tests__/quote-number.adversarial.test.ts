/**
 * Unit — Inputs adversariais ao normalizador de quote_number.
 *
 * Cobre:
 *  - Espaços extremos (NBSP, zero-width, tabs, newlines, controles)
 *  - Separadores alternativos (-, _, ., \, |, espaço, ÷)
 *  - Caracteres especiais (acentos, emojis, RTL, homoglyphs, SQLi-like)
 *  - Garante fallback estável → `null` (UI exibe placeholder amigável).
 */
import { describe, it, expect } from 'vitest';
import { formatQuoteNumberLabel } from '@/utils/quote-number';

describe('quote-number · inputs adversariais', () => {
  describe('espaços extremos e caracteres invisíveis', () => {
    // NOTA: `formatQuoteNumberLabel` saneia APENAS \s. Caracteres invisíveis
    // não-whitespace (zero-width, BOM, NBSP em alguns runtimes) devem cair no
    // fallback `null`, sem crash.
    it.each([
      ['\u00A0\u00A010010/26\u00A0', null], // NBSP (não bate \s no JS): rejeitado
      ['\u200B10010/26', null], // zero-width space
      ['\uFEFF10010/26', null], // BOM
      ['\u202E10010/26', null], // RTL override
      ['10010/26\u0000', null], // NUL
      ['  \r\n\t  10010/26  \r\n\t  ', '10010/26'], // whitespace clássico OK
    ])('input %j → %j (sem crash)', (input, expected) => {
      expect(() => formatQuoteNumberLabel(input)).not.toThrow();
      expect(formatQuoteNumberLabel(input)).toBe(expected);
    });
  });

  describe('separadores alternativos', () => {
    it.each(['10010-26', '10010_26', '10010.26', '10010\\26', '10010|26', '10010 26', '10010÷26'])(
      'rejeita separador não-canônico: %j',
      (input) => {
        expect(formatQuoteNumberLabel(input)).toBeNull();
      },
    );
  });

  describe('caracteres especiais', () => {
    it.each([
      '10010/26é',
      '10010/2💥',
      'ñ10010/26',
      '10010／26', // FULLWIDTH SOLIDUS (U+FF0F) — não é "/"
      '1０010/26', // FULLWIDTH digit (U+FF10)
      "10010/26'; DROP TABLE quotes;--",
      '<script>10010/26</script>',
      '10010/26\n10011/26',
    ])('rejeita lixo: %j', (input) => {
      expect(formatQuoteNumberLabel(input)).toBeNull();
    });
  });

  describe('fallback estável (idempotência sob ruído)', () => {
    it('chamadas repetidas com input inválido sempre retornam null', () => {
      for (let i = 0; i < 5; i++) {
        expect(formatQuoteNumberLabel('  lixo--26  ')).toBeNull();
        expect(formatQuoteNumberLabel(null)).toBeNull();
        expect(formatQuoteNumberLabel(undefined)).toBeNull();
      }
    });

    it('nunca lança em entradas estranhas (resilência)', () => {
      const weird = [
        '',
        ' ',
        '/',
        '//',
        '\n\n\n',
        '0/00',
        '0'.repeat(1000),
        'a/'.repeat(500),
      ];
      for (const w of weird) {
        expect(() => formatQuoteNumberLabel(w)).not.toThrow();
      }
    });
  });
});
