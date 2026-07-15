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
    expect(/^\d+$/.test(out!)).toBe(true);
  });
});

/**
 * Contrato de persistência (backend SSOT): usado por create/editar tanto
 * de FORNECEDOR quanto de PRODUTO (formulário de novo fornecedor
 * dentro do fluxo de produto). Qualquer valor com não-dígitos,
 * quantidade errada de dígitos ou DVs inválidos DEVE ser rejeitado
 * antes de chegar ao banco.
 */
describe('assertPersistableCnpj — contrato create/editar (fornecedor & produto)', () => {
  const NON_DIGIT_INPUTS = [
    '02.931.668/0001-8A',
    '02 931 668 0001 88x',
    'ABCDEFGHIJKLMN',
    '02.931.668/0001-88 ',
  ];

  it.each(NON_DIGIT_INPUTS)(
    'aceita input mascarado/sujo "%s" mas normaliza para dígitos-only ou rejeita',
    (input) => {
      // Não-dígitos são removidos; se o que sobrar for válido, retorna dígitos.
      // Caso contrário, lança.
      try {
        const out = assertPersistableCnpj(input);
        if (out !== null) expect(/^\d{14}$/.test(out)).toBe(true);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
    },
  );

  it('rejeita quantidade de dígitos < 14', () => {
    expect(() => assertPersistableCnpj('0293166800018')).toThrow(/14 d[ií]gitos/i);
  });

  it('rejeita quantidade de dígitos > 14 apenas se DVs não baterem', () => {
    // normalizeCnpj trunca para 14; se os 14 primeiros forem válidos, passa.
    // Caso de teste com truncamento que resulta em DV inválido:
    expect(() => assertPersistableCnpj('029316680001009999')).toThrow();
  });

  it('rejeita DVs inválidos (mesmo com 14 dígitos)', () => {
    expect(() => assertPersistableCnpj('02931668000100')).toThrow(/inv[aá]lido/i);
    expect(() => assertPersistableCnpj('11222333000199')).toThrow(/inv[aá]lido/i);
  });

  it('rejeita todos-iguais (regra CNPJ)', () => {
    expect(() => assertPersistableCnpj('11111111111111')).toThrow();
    expect(() => assertPersistableCnpj('00000000000000')).toThrow();
  });

  it('aceita CNPJ válido tanto mascarado quanto puro', () => {
    expect(assertPersistableCnpj('11.222.333/0001-81')).toBe('11222333000181');
    expect(assertPersistableCnpj('11222333000181')).toBe('11222333000181');
  });
});

