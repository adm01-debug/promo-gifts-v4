/**
 * cartCompanyCnpj — SSOT para resolver o rótulo exibido abaixo do nome da
 * empresa no popover "Meus Carrinhos".
 *
 * Regras (na ordem):
 *   1. Se o CRM (mapa `cnpjByCompanyId`) tiver um CNPJ para o `company_id`,
 *      usa esse CNPJ (com máscara).
 *   2. Senão, se `company_location` for um CNPJ cru (14 dígitos), usa esse
 *      valor com máscara.
 *   3. Senão, usa `company_location` como está (fallback ramo de atividade).
 *   4. Se nada disponível, retorna `null` — o consumidor deve suprimir o texto.
 *
 * Extraído de `CartHeaderButton.tsx` para permitir testes unitários exaustivos
 * sem carregar o componente todo (context, router, react-query, etc.).
 */
import { isNormalizedCnpj, maskCnpj, normalizeCnpj } from '@/utils/masks';

export interface CartCompanyCnpjInput {
  company_id: string;
  company_location: string | null;
}

export interface CartCompanyCnpjDisplay {
  /** Texto pronto para renderizar (já mascarado quando é CNPJ) ou null. */
  display: string | null;
  /** true quando o texto renderizado veio de um CNPJ (aciona `font-mono`). */
  isCnpj: boolean;
}

/**
 * Aceita string livre (com pontuação) no mapa; normaliza antes de comparar.
 * Retorno sem alocações desnecessárias — usado dentro de render.
 */
export function resolveCartCompanyCnpj(
  cart: CartCompanyCnpjInput,
  cnpjByCompanyId: ReadonlyMap<string, string | null | undefined>,
): CartCompanyCnpjDisplay {
  // 1) Lookup via CRM (fonte preferida — sempre atualizada)
  const crmRaw = cnpjByCompanyId.get(cart.company_id);
  const crmDigits = normalizeCnpj(crmRaw);
  if (isNormalizedCnpj(crmDigits)) {
    return { display: maskCnpj(crmDigits), isCnpj: true };
  }

  // 2) `company_location` armazenou CNPJ (carrinhos novos)
  const locDigits = normalizeCnpj(cart.company_location);
  if (isNormalizedCnpj(locDigits)) {
    return { display: maskCnpj(locDigits), isCnpj: true };
  }

  // 3) Fallback: ramo de atividade (carrinhos legados)
  const raw = (cart.company_location ?? '').trim();
  if (raw) return { display: raw, isCnpj: false };

  // 4) Nada para exibir
  return { display: null, isCnpj: false };
}
