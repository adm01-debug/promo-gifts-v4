import { describe, it, expect } from 'vitest';
import { cnpjOptionalSchema, assertPersistableCnpj } from './cnpj-schema';

describe('cnpjOptionalSchema', () => {
  it('normalizes masked CNPJ to 14-digit string on parse', () => {
    const parsed = cnpjOptionalSchema.parse('02.931.668/0001-88');
    expect(parsed).toBe('02931668000188');
  });

  it('accepts already-normalized 14-digit input', () => {
    expect(cnpjOptionalSchema.parse('02931668000188')).toBe('02931668000188');
  });

  it('coerces empty / whitespace / null / undefined to null', () => {
    expect(cnpjOptionalSchema.parse('')).toBeNull();
    expect(cnpjOptionalSchema.parse('   ')).toBeNull();
    expect(cnpjOptionalSchema.parse(null)).toBeNull();
    expect(cnpjOptionalSchema.parse(undefined)).toBeNull();
  });

  it('rejects partial (< 14 digits) after normalization', () => {
    const r = cnpjOptionalSchema.safeParse('02.931.668/0001-8');
    expect(r.success).toBe(false);
  });

  it('rejects CNPJ with invalid check digits', () => {
    // 14 dígitos, DVs errados
    const r = cnpjOptionalSchema.safeParse('02931668000100');
    expect(r.success).toBe(false);
  });
});

describe('assertPersistableCnpj', () => {
  it('returns null for empty/nullish', () => {
    expect(assertPersistableCnpj(null)).toBeNull();
    expect(assertPersistableCnpj(undefined)).toBeNull();
    expect(assertPersistableCnpj('')).toBeNull();
    expect(assertPersistableCnpj('   ')).toBeNull();
  });

  it('returns digits-only for masked input', () => {
    expect(assertPersistableCnpj('02.931.668/0001-88')).toBe('02931668000188');
  });

  it('throws for < 14 digits', () => {
    expect(() => assertPersistableCnpj('02.931.668/0001-8')).toThrow();
  });

  it('throws for CNPJ with invalid DVs', () => {
    expect(() => assertPersistableCnpj('02931668000100')).toThrow();
  });

  it('return value never contains non-digit characters', () => {
    const out = assertPersistableCnpj('02.931.668/0001-88');
    expect(out).not.toBeNull();
    expect(/^\d+$/.test(out as string)).toBe(true);
  });
});
