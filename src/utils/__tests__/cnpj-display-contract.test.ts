/**
 * B2 — Contrato de exibição do CNPJ mascarado.
 *
 * Valida propriedades determinísticas do par (maskCnpj, normalizeCnpj)
 * que sustentam a padronização "nome fantasia + CNPJ mascarado":
 *
 *   B2.1 (1000) — máscara idempotente sobre input persistível
 *   B2.2 ( 500) — formato canônico de saída p/ 14 dígitos válidos
 *   B2.3 ( 300) — tolerância a input parcial (0..13 dígitos, vazio, null)
 *   B2.4 ( 200) — round-trip: normalizeCnpj(maskCnpj(digits)) === digits
 *
 * Total: 2000 asserções.
 */
import { describe, it, expect } from 'vitest';
import { maskCnpj, normalizeCnpj, validateCnpj } from '@/utils/masks';

// PRNG determinístico (mulberry32) — seed fixa p/ reprodutibilidade.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0xC0FFEE_02);

function randomDigits(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(rand() * 10).toString();
  return s;
}

function calcDv(base: string): string {
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dv = (slice: string, weights: number[]) => {
    const sum = weights.reduce((s, w, i) => s + parseInt(slice[i]!, 10) * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base, w1);
  const d2 = dv(base + d1, w2);
  return `${d1}${d2}`;
}

function randomValidCnpj(): string {
  // evita todos-iguais
  let base: string;
  do {
    base = randomDigits(12);
  } while (/^(\d)\1{11}$/.test(base));
  return base + calcDv(base);
}

const CANONICAL_MASK = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

describe('B2.1 — maskCnpj é idempotente (1000 CNPJs válidos)', () => {
  for (let i = 0; i < 1000; i++) {
    const digits = randomValidCnpj();
    it(`idempotente #${i}: ${digits}`, () => {
      const once = maskCnpj(digits);
      const twice = maskCnpj(once);
      expect(twice).toBe(once);
    });
  }
});

describe('B2.2 — formato canônico p/ 14 dígitos (500 casos)', () => {
  for (let i = 0; i < 500; i++) {
    const digits = randomValidCnpj();
    it(`canônico #${i}`, () => {
      expect(maskCnpj(digits)).toMatch(CANONICAL_MASK);
      expect(validateCnpj(digits)).toBe(true);
    });
  }
});

describe('B2.3 — tolerância a input parcial (300 casos)', () => {
  const partials: Array<string | null | undefined> = [
    '', '   ', null, undefined,
  ];
  for (let n = 0; n <= 13; n++) {
    for (let k = 0; k < 20; k++) partials.push(randomDigits(n));
  }
  // Também: strings sujas
  for (let k = 0; k < 20; k++) {
    partials.push(`abc${randomDigits(Math.floor(rand() * 14))}xyz`);
  }
  for (const [i, v] of partials.entries()) {
    it(`parcial #${i} (${JSON.stringify(v)?.slice(0, 40)})`, () => {
      let out = '';
      expect(() => { out = maskCnpj(v); }).not.toThrow();
      expect(typeof out).toBe('string');
      // não pode conter tokens de erro
      expect(out).not.toMatch(/undefined|null|NaN/);
      // saída nunca ultrapassa a máscara canônica (18 chars)
      expect(out.length).toBeLessThanOrEqual(18);
    });
  }
});

describe('B2.4 — round-trip: nunca persiste máscara (200 CNPJs)', () => {
  for (let i = 0; i < 200; i++) {
    const digits = randomValidCnpj();
    it(`round-trip #${i}`, () => {
      const masked = maskCnpj(digits);
      expect(normalizeCnpj(masked)).toBe(digits);
      // dígitos-only da máscara == dígitos originais
      expect(masked.replace(/\D/g, '')).toBe(digits);
    });
  }
});
