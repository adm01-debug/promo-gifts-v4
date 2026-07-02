import { z } from 'zod';
import { normalizeCnpj, isNormalizedCnpj, validateCnpj } from './masks';

/**
 * Schema Zod que garante: qualquer CNPJ enviado a persistência é `null`
 * OU exatamente 14 dígitos (sem máscara/espaços/símbolos).
 *
 * Aceita input com máscara para conveniência: normaliza antes de validar.
 * Rejeita se, após normalizar, restarem menos ou mais de 14 dígitos.
 * DVs são validados por `validateCnpj`.
 *
 * SSOT — usar em toda chamada de create/update de fornecedor e produto.
 */
export const cnpjOptionalSchema = z
  .string()
  .nullable()
  .optional()
  .transform((v) => {
    const raw = v?.trim() ?? '';
    if (raw === '') return null;
    return normalizeCnpj(raw);
  })
  .refine((v) => v === null || isNormalizedCnpj(v), {
    message: 'CNPJ deve conter exatamente 14 dígitos (sem máscara).',
  })
  .refine((v) => v === null || validateCnpj(v), {
    message: 'CNPJ inválido (dígitos verificadores não conferem).',
  });

/**
 * Helper imperativo para code paths que ainda não usam Zod diretamente.
 * Lança erro (mensagem PT-BR) se o valor não puder ser persistido.
 */
export function assertPersistableCnpj(
  value: string | null | undefined,
): string | null {
  const parsed = cnpjOptionalSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'CNPJ inválido');
  }
  return parsed.data;
}
