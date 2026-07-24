import { describe, it, expect } from 'vitest';
import { mapCnpjError, CNPJ_ERROR_MESSAGES } from '@/utils/cnpj-errors';

describe('mapCnpjError — SSOT de mensagens inline', () => {
  it('mapeia mensagem do Zod (14 dígitos) → length_invalid', () => {
    const r = mapCnpjError(new Error('CNPJ deve conter exatamente 14 dígitos (sem máscara).'));
    expect(r.code).toBe('cnpj_length_invalid');
    expect(r.message).toBe(CNPJ_ERROR_MESSAGES.cnpj_length_invalid);
  });

  it('mapeia mensagem do Zod (DVs) → dv_invalid', () => {
    const r = mapCnpjError(new Error('CNPJ inválido (dígitos verificadores não conferem).'));
    expect(r.code).toBe('cnpj_dv_invalid');
  });

  it('mapeia Postgres 23505 → duplicated', () => {
    const r = mapCnpjError({ code: '23505', message: 'duplicate key value violates unique constraint' });
    expect(r.code).toBe('cnpj_duplicated');
  });

  it('mapeia Postgres 23514 (check cnpj_length) → length_invalid', () => {
    const r = mapCnpjError({
      code: '23514',
      message: 'new row violates check constraint "cnpj_length_chk"',
    });
    expect(r.code).toBe('cnpj_length_invalid');
  });

  it('mapeia check cnpj_digits_only → dv_invalid (não-dígitos)', () => {
    const r = mapCnpjError({
      code: '23514',
      message: 'check constraint "cnpj_digits_only_chk"',
    });
    expect(r.code).toBe('cnpj_dv_invalid');
  });

  it('mapeia string livre "already exists" → duplicated', () => {
    expect(mapCnpjError('CNPJ already exists').code).toBe('cnpj_duplicated');
  });

  it('fallback → unknown', () => {
    expect(mapCnpjError(null).code).toBe('cnpj_unknown');
    expect(mapCnpjError({}).code).toBe('cnpj_unknown');
  });

  it('todas as mensagens são PT-BR não-técnicas', () => {
    for (const msg of Object.values(CNPJ_ERROR_MESSAGES)) {
      expect(msg).toMatch(/^[A-ZÀ-Ú]/);
      expect(msg).not.toMatch(/error|null|undefined|constraint/i);
    }
  });
});
