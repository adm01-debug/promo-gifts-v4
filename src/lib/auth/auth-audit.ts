import { getSupabaseClient } from '../../integrations/supabase/lazy-client';

export async function runAuthAudit() {
  try {
    const supabase = await getSupabaseClient();
    // A RPC check_auth_config_status ainda NÃO existe em public (re-verificado
    // 2026-06-11 via pg_proc no SSOT doufsxqlfjyuvxuezpln). A chamada degrada
    // graciosamente (error tratado abaixo). O types.ts atual já tipa a função,
    // então o @ts-expect-error anterior virou TS2578 (unused) e foi removido.
    const { data, error } = await supabase.rpc('check_auth_config_status');

    if (error) {
      console.error('[AuthAudit] Falha ao executar auditoria:', error.message);
      return { success: false, error: error.message };
    }

    console.warn('[AuthAudit] Resultado:', data);
    return { success: true, data };
  } catch (err) {
    console.error('[AuthAudit] Erro inesperado:', err);
    return { success: false, error: String(err) };
  }
}
