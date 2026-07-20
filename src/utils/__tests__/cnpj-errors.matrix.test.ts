/**
 * Matriz de contrato UI ↔ mapper.
 *
 * Garante que cada mensagem retornada por `mapCnpjError` case com as
 * regex que a UI (e os testes de contrato) esperam. Se alguém trocar a
 * copy em `CNPJ_ERROR_MESSAGES` sem atualizar os testes de UI, este
 * spec falha primeiro.
 */
import { describe, it, expect } from 'vitest';
import { mapCnpjError, CNPJ_ERROR_MESSAGES, type CnpjErrorCode } from '@/utils/cnpj-errors';

// Regex usadas em cnpj-api-contract.test.ts / cnpj-schema.test.ts.
const UI_REGEX_BY_CODE: Record<CnpjErrorCode, RegExp> = {
  cnpj_length_invalid: /14 d[ií]gitos/i,
  cnpj_dv_invalid: /inv[aá]lido/i,
  cnpj_duplicated: /j[aá] cadastrado/i,
  cnpj_unknown: /inv[aá]lido/i,
};

describe('mapCnpjError — contrato UI', () => {
  it('cada mensagem canônica casa com a regex esperada pela UI', () => {
    for (const [code, msg] of Object.entries(CNPJ_ERROR_MESSAGES) as Array<
      [CnpjErrorCode, string]
    >) {
      expect(msg, `code=${code}`).toMatch(UI_REGEX_BY_CODE[code]);
    }
  });

  it('toda chave de CNPJ_ERROR_MESSAGES é alcançável por ≥ 1 input real', () => {
    const reachable: Record<CnpjErrorCode, unknown> = {
      cnpj_length_invalid: new Error('CNPJ deve conter exatamente 14 dígitos (sem máscara).'),
      cnpj_dv_invalid: new Error('CNPJ inválido (DVs)'),
      cnpj_duplicated: { code: '23505', message: 'duplicate' },
      cnpj_unknown: null,
    };
    for (const code of Object.keys(reachable) as CnpjErrorCode[]) {
      expect(mapCnpjError(reachable[code]).code).toBe(code);
    }
  });

  it('nunca vaza tokens técnicos na mensagem final', () => {
    const inputs: unknown[] = [
      new Error('at Object.<anonymous> stack trace'),
      { code: '23514', message: 'new row violates check constraint "public.cnpj_length_chk"' },
      { code: '42P01', message: 'relation "suppliers" does not exist' },
      'SELECT * FROM suppliers WHERE cnpj IS NULL',
      {
        get message() {
          throw new Error('boom');
        },
      },
    ];
    for (const inp of inputs) {
      const { message } = mapCnpjError(inp);
      expect(message).not.toMatch(/stack|constraint|select |relation|column "/i);
      expect(Object.values(CNPJ_ERROR_MESSAGES)).toContain(message);
    }
  });
});
