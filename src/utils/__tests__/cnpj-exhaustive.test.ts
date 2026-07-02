/**
 * Bateria exaustiva do SSOT de CNPJ (~5.800 asserções).
 * Determinística (seeds fixas). Roda em <2s.
 */
import { describe, it, expect } from 'vitest';
import { normalizeCnpj, maskCnpj, isNormalizedCnpj, validateCnpj } from '../masks';
import { cnpjOptionalSchema, assertPersistableCnpj } from '../cnpj-schema';
import { generateValidCnpj, mulberry32, mutate, randomMask, type MutationKind } from './cnpj-fuzz-helpers';

const SEED = 0xC0FFEE;

describe('CNPJ — B1 idempotência massiva (1.000 casos)', () => {
  it('normalize(normalize(x)) === normalize(x)', () => {
    const rand = mulberry32(SEED);
    for (let i = 0; i < 1000; i++) {
      const cnpj = generateValidCnpj(i + 1);
      const masked = randomMask(cnpj, rand);
      const once = normalizeCnpj(masked);
      const twice = normalizeCnpj(once);
      expect(twice).toBe(once);
    }
  });
});

describe('CNPJ — B2 roundtrip (1.000 casos)', () => {
  it('normalize(mask(normalize(v))) === normalize(v)', () => {
    for (let i = 0; i < 1000; i++) {
      const cnpj = generateValidCnpj(i + 1);
      expect(normalizeCnpj(maskCnpj(cnpj))).toBe(cnpj);
      expect(isNormalizedCnpj(cnpj)).toBe(true);
      expect(validateCnpj(cnpj)).toBe(true);
    }
  });
});

describe('CNPJ — B3 fuzz de mutações (2.000 casos)', () => {
  it('mutações inválidas rejeitam; válidas passam', () => {
    const rand = mulberry32(SEED + 1);
    const kinds: MutationKind[] = [
      'inject-letter', 'break-dv', 'truncate', 'zero-width',
      'nbsp', 'rtl', 'emoji', 'whitespace', 'noop',
    ];
    for (let i = 0; i < 2000; i++) {
      const cnpj = generateValidCnpj(i + 100);
      const kind = kinds[i % kinds.length];
      const { value, expectValid } = mutate(cnpj, kind, rand);
      const result = cnpjOptionalSchema.safeParse(value);
      if (expectValid) {
        expect(result.success, `kind=${kind} value=${JSON.stringify(value)}`).toBe(true);
        if (result.success) expect(result.data).toBe(cnpj);
      } else {
        expect(result.success, `kind=${kind} deveria falhar`).toBe(false);
      }
    }
  });
});

describe('CNPJ — B4 unicode adversarial (500 casos)', () => {
  it('sempre normaliza para 14 dígitos limpos ou rejeita', () => {
    const rand = mulberry32(SEED + 2);
    const noise = ['\u200D', '\u200B', '\u00A0', '\u202E', '🎁', '  ', '\t', '\n'];
    for (let i = 0; i < 500; i++) {
      const cnpj = generateValidCnpj(i + 500);
      let poisoned = '';
      for (const ch of cnpj) poisoned += noise[Math.floor(rand() * noise.length)] + ch;
      const norm = normalizeCnpj(poisoned);
      expect(/^\d*$/.test(norm)).toBe(true);
      const parsed = cnpjOptionalSchema.safeParse(poisoned);
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data).toBe(cnpj);
    }
  });
});

describe('CNPJ — B5 boundary de comprimento (500 casos)', () => {
  it('só 14 dígitos com DV válido passa', () => {
    const rand = mulberry32(SEED + 3);
    for (let i = 0; i < 500; i++) {
      const len = Math.floor(rand() * 31);
      let s = '';
      for (let k = 0; k < len; k++) s += Math.floor(rand() * 10);
      const parsed = cnpjOptionalSchema.safeParse(s);
      if (len === 14 && validateCnpj(s)) {
        expect(parsed.success).toBe(true);
      } else if (len === 0) {
        expect(parsed.success).toBe(true);
        if (parsed.success) expect(parsed.data).toBeNull();
      } else if (len > 14) {
        // normalize trunca; passa só se os 14 primeiros forem válidos
        const truncated = s.slice(0, 14);
        expect(parsed.success).toBe(validateCnpj(truncated));
      } else {
        expect(parsed.success).toBe(false);
      }
    }
  });
});

describe('CNPJ — B6 todos-iguais', () => {
  it('rejeita 00000000000000..99999999999999', () => {
    for (let d = 0; d < 10; d++) {
      const s = String(d).repeat(14);
      expect(cnpjOptionalSchema.safeParse(s).success).toBe(false);
    }
  });
});

describe('CNPJ — B7 DV cross-check (500 casos × 26 vizinhos)', () => {
  // Nota matemática: pela regra oficial "r<2 → DV=0", certas mutações de
  // 1 dígito colidem no mesmo DV computado (falso positivo raro). Este
  // teste garante que a taxa de colisão fica abaixo de 2% — comportamento
  // esperado do algoritmo, não um bug do nosso SSOT.
  it('mutação de 1 dígito quase sempre invalida (taxa de colisão < 2%)', () => {
    let total = 0;
    let stillValid = 0;
    for (let i = 0; i < 500; i++) {
      const cnpj = generateValidCnpj(i + 2000);
      for (let pos = 0; pos < 14; pos++) {
        const orig = parseInt(cnpj[pos], 10);
        for (const delta of [1, 9]) {
          const mutated = cnpj.slice(0, pos) + ((orig + delta) % 10) + cnpj.slice(pos + 1);
          if (mutated === cnpj) continue;
          total++;
          if (validateCnpj(mutated)) stillValid++;
        }
      }
    }
    const rate = stillValid / total;
    expect(rate, `colisão=${(rate * 100).toFixed(2)}% (${stillValid}/${total})`).toBeLessThan(0.02);
  });
});

describe('CNPJ — B8 schema × helper (200 casos)', () => {
  it('cnpjOptionalSchema e assertPersistableCnpj concordam', () => {
    const rand = mulberry32(SEED + 5);
    const inputs: unknown[] = [null, undefined, '', '   '];
    for (let i = 0; i < 196; i++) {
      const v = generateValidCnpj(i + 3000);
      inputs.push(rand() > 0.5 ? maskCnpj(v) : v);
    }
    for (const v of inputs) {
      const p = cnpjOptionalSchema.safeParse(v);
      if (p.success) {
        expect(assertPersistableCnpj(v as string | null | undefined)).toBe(p.data);
      } else {
        expect(() => assertPersistableCnpj(v as string)).toThrow();
      }
    }
  });
});

describe('CNPJ — B9 payload contract (100 casos)', () => {
  it('payload final sempre null OU /^\\d{14}$/', () => {
    for (let i = 0; i < 100; i++) {
      const cnpj = generateValidCnpj(i + 4000);
      const payload = { cnpj: assertPersistableCnpj(maskCnpj(cnpj)) };
      expect(payload.cnpj === null || /^\d{14}$/.test(payload.cnpj!)).toBe(true);
    }
    expect(assertPersistableCnpj(null)).toBeNull();
    expect(assertPersistableCnpj('')).toBeNull();
  });
});
