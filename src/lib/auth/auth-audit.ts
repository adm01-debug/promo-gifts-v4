import { getSupabaseClient } from '../../integrations/supabase/lazy-client';
import { logger } from '@/lib/logger';

export async function runAuthAudit() {
  try {
    const supabase = await getSupabaseClient();
    // A RPC check_auth_config_status ainda NÃO existe em public (re-verificado
    // 2026-06-11 via pg_proc no SSOT doufsxqlfjyuvxuezpln). A chamada degrada
    // graciosamente (error tratado abaixo).
    const { data, error } = await supabase.rpc('check_auth_config_status');

    if (error) {
      logger.error('[AuthAudit] Falha ao executar auditoria:', error.message);
      return { success: false, error: error.message };
    }

    logger.warn('[AuthAudit] Resultado:', data);
    return { success: true, data };
  } catch (err) {
    logger.error('[AuthAudit] Erro inesperado:', err);
    return { success: false, error: String(err) };
  }
}
