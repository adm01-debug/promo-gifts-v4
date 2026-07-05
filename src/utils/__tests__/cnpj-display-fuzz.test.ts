/**
 * B4 — Fuzz de entrada arbitrária para maskCnpj (fast-check, 3×500 runs).
 *
 * Propriedades:
 *   P1 (500) — maskCnpj(s) nunca lança, retorna string sem tokens de erro
 *   P2 (500) — dígitos da máscara são prefixo dos dígitos normalizados
 *              (máscara nunca "inventa" dígitos)
 *   P3 (500) — |maskCnpj(s)| ≤ 18 (máscara canônica)
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { maskCnpj, normalizeCnpj } from '@/utils/masks';

describe('B4.P1 — maskCnpj é total (nunca lança) [500 runs]', () => {
  it('propriedade', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const out = maskCnpj(s);
        expect(typeof out).toBe('string');
        expect(out).not.toMatch(/undefined|null|NaN/);
      }),
      { numRuns: 500, seed: 0xC0FFEE },
    );
  });
});

describe('B4.P2 — dígitos da máscara ≡ normalizeCnpj (não inventa) [500 runs]', () => {
  it('propriedade', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const masked = maskCnpj(s);
        const normalized = normalizeCnpj(s);
        expect(masked.replace(/\D/g, '')).toBe(normalized);
      }),
      { numRuns: 500, seed: 0xC0FFEE + 1 },
    );
  });
});

describe('B4.P3 — saída sempre ≤ 18 chars [500 runs]', () => {
  it('propriedade', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(maskCnpj(s).length).toBeLessThanOrEqual(18);
      }),
      { numRuns: 500, seed: 0xC0FFEE + 2 },
    );
  });
});

describe('B4.P4 — Unicode adversarial (NBSP/ZWSP/RTL/emoji) [500 runs]', () => {
  const CHARS = [
    '0','1','2','3','4','5','6','7','8','9',
    '.', '-', '/', ' ',
    '\u00A0', '\u200B', '\u200D', '\u202E', '💥', 'a', 'X', '#',
  ];
  const adversarial = fc
    .array(fc.constantFrom(...CHARS), { maxLength: 32 })
    .map((arr) => arr.join(''));
  it('propriedade', () => {
    fc.assert(
      fc.property(adversarial, (s) => {
        const out = maskCnpj(s);
        expect(typeof out).toBe('string');
        expect(out.length).toBeLessThanOrEqual(18);
        expect(out.replace(/\D/g, '')).toBe(normalizeCnpj(s));
      }),
      { numRuns: 500, seed: 0xC0FFEE + 3 },
    );
  });
});
