/**
 * SSOT de mensagens inline de CNPJ.
 *
 * Consumido por fornecedor (SupplierFormDialog / useSuppliersManager)
 * e produto (BasicDataTab / useNewSupplierForm). Também usado para
 * mapear erros do backend (Postgres CHECK, PostgREST 23514, RPC) para
 * a MESMA mensagem exibida no cliente, evitando drift de copy.
 */

export type CnpjErrorCode =
  'cnpj_duplicated' | 'cnpj_dv_invalid' | 'cnpj_length_invalid' | 'cnpj_unknown';

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
 *      * `23514` (check_violation):
 *        constraint `*_cnpj_length_chk` → length_invalid;
 *        constraint `*_cnpj_digits_only_chk` → dv_invalid.
 *      * `23505` (unique_violation) em coluna cnpj → duplicated
 *        (ex.: índice `suppliers_cnpj_org_uniq`).
 *  - Mensagens livres contendo "duplic" / "already exists" → duplicated.
 */
/**
 * Leitura defensiva de um campo de erro: getters de erros externos podem
 * lançar, e código de tratamento de erro NUNCA pode ele mesmo explodir.
 */
function readErrField(
  input: unknown,
  key: 'code' | 'details' | 'message',
): string {
  try {
    if (typeof input !== 'object' || input === null) return '';
    const v = (input as Record<string, unknown>)[key];
    return v == null ? '' : String(v);
  } catch {
    return '';
  }
}

/**
 * Haystack seguro (message + details) para gates `/cnpj/i` em catches.
 * Garantia: NUNCA lança. Use isto nos hooks em vez de montar template
 * literal direto sobre o erro (getter hostil derrubaria o catch).
 */
export function cnpjErrorHaystack(input: unknown): string {
  try {
    if (typeof input === 'string') return input;
    return `${readErrField(input, 'message')} ${readErrField(input, 'details')}`;
  } catch {
    return '';
  }
}

export function mapCnpjError(input: unknown): {
  code: CnpjErrorCode;
  message: string;
} {
  const code = readErrField(input, 'code');
  const hay = cnpjErrorHaystack(input).toLowerCase();

  if (code === '23505' || /duplic|already exists|unique/i.test(hay)) {
    return { code: 'cnpj_duplicated', message: CNPJ_ERROR_MESSAGES.cnpj_duplicated };
  }
  if (/14 d[ií]gitos|length|too short|too long/i.test(hay) || hay.includes('cnpj_length')) {
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

