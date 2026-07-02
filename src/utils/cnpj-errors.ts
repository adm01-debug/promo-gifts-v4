/**
 * SSOT de mensagens inline de CNPJ.
 *
 * Consumido por fornecedor (SupplierFormDialog / useSuppliersManager)
 * e produto (BasicDataTab / useNewSupplierForm). Também usado para
 * mapear erros do backend (Postgres CHECK, PostgREST 23514, RPC) para
 * a MESMA mensagem exibida no cliente, evitando drift de copy.
 */

export type CnpjErrorCode =
  | 'cnpj_length_invalid'
  | 'cnpj_dv_invalid'
  | 'cnpj_duplicated'
  | 'cnpj_unknown';

export const CNPJ_ERROR_MESSAGES: Record<CnpjErrorCode, string> = {
  cnpj_length_invalid: 'CNPJ deve conter exatamente 14 dígitos (sem máscara).',
  cnpj_dv_invalid: 'CNPJ inválido (dígitos verificadores não conferem).',
  cnpj_duplicated: 'CNPJ já cadastrado.',
  cnpj_unknown: 'CNPJ inválido.',
};

/**
 * Recebe qualquer erro (Error, PostgrestError-like, string) e devolve
 * a mensagem inline canônica em PT-BR + o código estrutural.
 *
 * Suporta:
 *  - Mensagens do `assertPersistableCnpj` (Zod) — casam por regex.
 *  - Códigos Postgres/PostgREST:
 *      * `23514` (check_violation) com constraint `cnpj_digits_only_chk`
 *        ou `cnpj_length_chk` → length_invalid.
 *      * `23505` (unique_violation) em coluna cnpj → duplicated.
 *  - Mensagens livres contendo "duplic" / "already exists" → duplicated.
 */
export function mapCnpjError(input: unknown): {
  code: CnpjErrorCode;
  message: string;
} {
  const raw =
    typeof input === 'string'
      ? input
      : (input as { message?: string; code?: string; details?: string })
          ?.message ?? '';
  const code =
    typeof input === 'object' && input !== null
      ? String((input as { code?: string }).code ?? '')
      : '';
  const details =
    typeof input === 'object' && input !== null
      ? String((input as { details?: string }).details ?? '')
      : '';
  const hay = `${raw} ${details}`.toLowerCase();

  if (code === '23505' || /duplic|already exists|unique/i.test(hay)) {
    return { code: 'cnpj_duplicated', message: CNPJ_ERROR_MESSAGES.cnpj_duplicated };
  }
  if (/14 d[ií]gitos|length|too short|too long/i.test(hay) || /cnpj_length/.test(hay)) {
    return {
      code: 'cnpj_length_invalid',
      message: CNPJ_ERROR_MESSAGES.cnpj_length_invalid,
    };
  }
  if (/inv[aá]lido|dv|verificador|checksum|digits_only|check constraint/i.test(hay)) {
    return { code: 'cnpj_dv_invalid', message: CNPJ_ERROR_MESSAGES.cnpj_dv_invalid };
  }
  return { code: 'cnpj_unknown', message: CNPJ_ERROR_MESSAGES.cnpj_unknown };
}
