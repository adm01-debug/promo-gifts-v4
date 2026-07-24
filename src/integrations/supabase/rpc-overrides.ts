/**
 * rpc-overrides.ts
 * Stubs de tipos para RPCs criadas manualmente em migrations —
 * não incluídas no types.ts gerado pelo supabase gen types.
 *
 * Atualizar ou remover este arquivo após rodar:
 *   supabase gen types typescript --project-id doufsxqlfjyuvxuezpln > src/integrations/supabase/types.ts
 * e confirmar que get_profile_and_roles aparece em Database['public']['Functions'].
 *
 * Criado em 2026-07-14 como parte do fix BUG-AUTH-HYDRATION-v2.
 */

import type { AppRole, Profile } from '@/contexts/AuthContext';

/** Retorno JSON da RPC pública get_profile_and_roles(_user_id uuid). */
export interface GetProfileAndRolesResult {
  /** Linha da tabela profiles correspondente ao _user_id, ou null se ausente. */
  profile: Profile | null;
  /**
   * Array de roles do usuário em user_roles.
   * Vazio ([]) quando o usuário não tem roles — nunca null (COALESCE na RPC).
   */
  roles: AppRole[] | null;
}

/**
 * Cast helper: substitui o supabase.rpc genérico pelo tipo exato da RPC,
 * evitando `as unknown as` espalhado pelo código.
 *
 * @example
 * ```typescript
 * const { data, error } = await typedRPC<GetProfileAndRolesResult>(
 *   supabase, 'get_profile_and_roles', { _user_id: userId }
 * );
 * ```
 */
export type SupabaseRPCCaller<TReturn = unknown> = (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{
  data: TReturn | null;
  error: { code?: string; message?: string; details?: string | null } | null;
}>;

/**
 * Converte o rpc() do cliente Supabase para o tipo esperado pela RPC.
 * Uso seguro com double-assertion: evita erros do compilador TS em strict mode.
 */
export function asTypedRPC<TReturn>(
  rpcFn: unknown,
): SupabaseRPCCaller<TReturn> {
  return rpcFn as unknown as SupabaseRPCCaller<TReturn>;
}
