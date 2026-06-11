import { getSupabaseClient } from '../../integrations/supabase/lazy-client';

export async function runAuthAudit() {
  try {
    const supabase = await getSupabaseClient();
    // A RPC check_auth_config_status ainda NÃO existe em public (verificado
    // 2026-06-11); o types.ts regenerado passou a acusar. A chamada degrada
    // graciosamente (error tratado abaixo). Remover o expect-error quando a
    // função for criada no banco.
    // @ts-expect-error RPC pendente de migração
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
