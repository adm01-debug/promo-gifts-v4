/**
 * apply-seller-scope — helper de defesa em profundidade.
 *
 * Aplica `.eq("seller_id", userId)` automaticamente em queries Supabase
 * quando o escopo de visibilidade do usuário for `self`. Isto evita que
 * a UI dispare requisições amplas que dependeriam apenas do RLS para
 * filtragem (reduz tráfego, latência e carga no banco — além de
 * funcionar como um cinto a mais sobre o RLS).
 *
 * Uso:
 *   const scope = useSalesScope();
 *   const q = applySellerScope(supabase.from("quotes").select("*"), {
 *     scope, userId: user.id,
 *   });
 *
 * Para hooks fora do contexto React (services), aceitar `scope` + `userId`
 * como parâmetros e delegar ao helper.
 */
import type { SalesScope } from './visibility-scope';

// Tipo mínimo para suportar PostgrestFilterBuilder genérico sem importar o tipo
// (a chamada `.eq` retorna o próprio builder, então preservamos o tipo de entrada).
type EqCapable<T> = T & { eq: (column: string, value: string) => T };

export interface SellerScopeOptions {
  scope: SalesScope;
  userId: string | null | undefined;
  /** Coluna usada para o filtro. Default: "seller_id". */
  column?: string;
}

export function applySellerScope<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  { scope, userId, column = 'seller_id' }: SellerScopeOptions,
): T {
  if (scope === 'self' && userId) {
    return (query as EqCapable<T>).eq(column, userId);
  }
  return query;
}

/**
 * shouldShortCircuit — quando o usuário é `self` mas não temos `userId`
 * (ex.: ainda não autenticado), o melhor é não disparar a query.
 * Retorna `true` se a query deve ser pulada.
 */
export function shouldShortCircuitForSelf(
  scope: SalesScope,
  userId: string | null | undefined,
): boolean {
  return scope === 'self' && !userId;
}
