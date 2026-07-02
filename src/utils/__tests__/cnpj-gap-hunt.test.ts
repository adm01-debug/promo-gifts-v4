/**
 * Gap-hunt: hipóteses adversariais G1..G10 sobre a SSOT de CNPJ + adjacências.
 * Cada `describe` é uma hipótese a refutar. Nunca queremos que ela vire "PASS
 * (bug reproduzido)" — a suite deve derrubá-las todas.
 */
import { describe, it, expect } from 'vitest';
import { maskCnpj, normalizeCnpj, isNormalizedCnpj, validateCnpj } from '@/utils/masks';
import { assertPersistableCnpj, cnpjOptionalSchema } from '@/utils/cnpj-schema';

const VALID = '02931668000188';
const VALID_MASKED = '02.931.668/0001-88';

describe('G1 — maskCnpj com input já mascarado não duplica separadores', () => {
  it('idempotência: mask(mask(x)) === mask(x)', () => {
    expect(maskCnpj(maskCnpj(VALID))).toBe(VALID_MASKED);
    expect(maskCnpj(VALID_MASKED)).toBe(VALID_MASKED);
    expect(maskCnpj(maskCnpj(maskCnpj(VALID_MASKED)))).toBe(VALID_MASKED);
  });
  it('input parcial mascarado não gera pontuação órfã', () => {
    expect(maskCnpj('02.931')).toBe('02.931');
    expect(maskCnpj('02.9')).toBe('02.9');
    expect(maskCnpj('')).toBe('');
  });
});

describe('G2 — normalizeCnpj com surrogate pairs / emoji / unicode invisível', () => {
  const cases = [
    `02.931.668/0001-88🎉`,
    `\u200B02.931.668/0001-88\u200B`, // ZWSP
    `\u00A002931668000188\u00A0`, // NBSP
    `02\u200D931668000188`, // ZWJ dentro
    `😀02931668000188`,
    `０２９３１６６８０００１８８`, // full-width digits (NÃO ASCII → devem sumir)
  ];
  for (const c of cases) {
    it(`sanitiza: ${JSON.stringify(c)}`, () => {
      const out = normalizeCnpj(c);
      expect(out).toMatch(/^\d{0,14}$/);
      expect(out).not.toMatch(/\D/);
    });
  }
  it('full-width digits são REJEITADOS (não são \\d ASCII garantido)', () => {
    // Documenta o comportamento atual: \d em JS casa Unicode digits por padrão? Não — apenas ASCII.
    const out = normalizeCnpj('０２９３１６６８０００１８８');
    expect(out).toBe('');
  });
});

describe('G3 — cnpjOptionalSchema: safeParse e assert concordam sempre', () => {
  const samples = ['', '   ', null, undefined, VALID, VALID_MASKED, '00000000000000', '02931668000100', 'abc', '123'];
  for (const s of samples) {
    it(`consistência assert vs safeParse: ${JSON.stringify(s)}`, () => {
      const parsed = cnpjOptionalSchema.safeParse(s);
      if (parsed.success) {
        expect(() => assertPersistableCnpj(s)).not.toThrow();
        expect(assertPersistableCnpj(s)).toBe(parsed.data);
      } else {
        expect(() => assertPersistableCnpj(s)).toThrow();
      }
    });
  }
});

describe('G4 — handleEdit-like: normalização de valor vindo do BD (mascarado/null/undefined)', () => {
  const fromDb = ['02.931.668/0001-88', '02931668000188', null, undefined, ''];
  for (const v of fromDb) {
    it(`normaliza input DB: ${JSON.stringify(v)}`, () => {
      const n = normalizeCnpj(v);
      expect(n).toMatch(/^\d{0,14}$/);
      if (v && String(v).replace(/\D/g, '').length === 14) {
        expect(n).toBe(VALID);
      } else {
        expect(n.length).toBeLessThanOrEqual(14);
      }
    });
  }
});

describe('G7 — showUndoToast frozenMs: contrato de tipo/design (smoke)', () => {
  it('módulo exporta UndoToastContent com prop frozenMs opcional', async () => {
    const mod = await import('@/utils/undoToast');
    expect(typeof mod.UndoToastContent).toBe('function');
    expect(typeof mod.showUndoToast).toBe('function');
  });
});

describe('G8 — mask idempotente evita double-mask no card', () => {
  it('mask(dbMasked) === mask(dbDigits)', () => {
    expect(maskCnpj(VALID_MASKED)).toBe(maskCnpj(VALID));
  });
});

describe('G10 — assertPersistableCnpj: vazio/null/undefined todos viram null (consistente supplier+product)', () => {
  for (const v of ['', '   ', '\t', null, undefined]) {
    it(`${JSON.stringify(v)} → null`, () => {
      expect(assertPersistableCnpj(v)).toBeNull();
    });
  }
  it('14 dígitos válidos → dígitos-only', () => {
    expect(assertPersistableCnpj(VALID_MASKED)).toBe(VALID);
    expect(assertPersistableCnpj(VALID)).toBe(VALID);
  });
  it('rejeita DV inválido', () => {
    expect(() => assertPersistableCnpj('02931668000100')).toThrow(/inv[aá]lido/i);
  });
  it('rejeita contagem !== 14', () => {
    expect(() => assertPersistableCnpj('123')).toThrow(/14 d[ií]gitos/i);
    expect(() => assertPersistableCnpj('0'.repeat(15))).toThrow();
  });
});

// ─── Property-based rápido inline (5.000 iterações) ─────────────────────────
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function genValidCnpj(rnd: () => number): string {
  const base = Array.from({ length: 12 }, () => Math.floor(rnd() * 10));
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let s = base.reduce((acc, d, i) => acc + d * w1[i], 0) % 11;
  const d1 = s < 2 ? 0 : 11 - s;
  const arr13 = [...base, d1];
  s = arr13.reduce((acc, d, i) => acc + d * w2[i], 0) % 11;
  const d2 = s < 2 ? 0 : 11 - s;
  const cnpj = [...arr13, d2].join('');
  // Rejeita all-same (extremamente raro mas possível)
  if (/^(\d)\1{13}$/.test(cnpj)) return genValidCnpj(rnd);
  return cnpj;
}
function scatterMask(rnd: () => number, digits: string): string {
  const noise = [' ', '.', '-', '/', '  ', '\t'];
  let out = '';
  for (const ch of digits) {
    out += ch;
    if (rnd() < 0.15) out += noise[Math.floor(rnd() * noise.length)];
  }
  return out;
}

describe('Property-based (5.000 iter): SSOT do CNPJ', () => {
  const N = 5000;
  const rnd = mulberry32(0xC0FFEE);

  it(`${N} amostras: normalize(mask(normalize(x))) === normalize(x)`, () => {
    for (let i = 0; i < N; i++) {
      const v = genValidCnpj(rnd);
      const scattered = scatterMask(rnd, v);
      const n = normalizeCnpj(scattered);
      expect(n).toBe(v);
      expect(normalizeCnpj(maskCnpj(n))).toBe(n);
    }
  });

  it(`${N} amostras: mask(normalize(valid)) tem 18 chars e regex canônica`, () => {
    const r = mulberry32(0xBADA55);
    const re = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
    for (let i = 0; i < N; i++) {
      const v = genValidCnpj(r);
      const m = maskCnpj(v);
      expect(m).toHaveLength(18);
      expect(m).toMatch(re);
    }
  });

  it(`${N} amostras: assertPersistableCnpj nunca retorna não-dígito`, () => {
    const r = mulberry32(0xDECAF);
    for (let i = 0; i < N; i++) {
      const v = genValidCnpj(r);
      const masked = scatterMask(r, v);
      const out = assertPersistableCnpj(masked);
      expect(out).not.toBeNull();
      expect(out!).toMatch(/^\d{14}$/);
      expect(validateCnpj(out!)).toBe(true);
      expect(isNormalizedCnpj(out!)).toBe(true);
    }
  });

  it(`${N} amostras adversariais: entrada aleatória nunca vaza máscara na saída aceita`, () => {
    const r = mulberry32(0xF00D);
    let accepted = 0;
    let rejected = 0;
    for (let i = 0; i < N; i++) {
      // Mistura chars aleatórios ASCII
      const len = 1 + Math.floor(r() * 30);
      const s = Array.from({ length: len }, () => String.fromCharCode(32 + Math.floor(r() * 95))).join('');
      const parsed = cnpjOptionalSchema.safeParse(s);
      if (parsed.success) {
        accepted++;
        if (parsed.data !== null) {
          expect(parsed.data).toMatch(/^\d{14}$/);
        }
      } else {
        rejected++;
      }
    }
    // Sanity: majoritariamente rejeitados
    expect(rejected).toBeGreaterThan(accepted);
  });
});
