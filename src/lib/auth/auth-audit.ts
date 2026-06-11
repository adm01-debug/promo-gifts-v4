import { getSupabaseClient } from '../../integrations/supabase/lazy-client';

export async function runAuthAudit() {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.rpc('check_auth_config_status');

    if (error) {
      console.error('[AuthAudit] Falha ao executar auditoria:', error.message);
      return { success: false, error: error.message };
    }

    // eslint-disable-next-line no-console
    console.log('[AuthAudit] Resultado:', data);
    return { success: true, data };
  } catch (err) {
    console.error('[AuthAudit] Erro inesperado:', err);
    return { success: false, error: String(err) };
  }
}
