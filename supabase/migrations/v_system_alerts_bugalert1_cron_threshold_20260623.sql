-- BUG-ALERT-1 FIX (2026-06-23): CRON_FAIL_RECENT threshold inteligente
-- HAVING count(*)>0 gerava 6 alertas CRITICAL falsos por falha transitória
-- do pg_cron scheduler (job startup timeout). Fix: critério duplo.
-- DRY-RUN validado: 4 cenários adversariais, todos corretos.
-- Aplicado em produção via MCP às 18:30 UTC 2026-06-23.
-- (conteúdo completo em supabase/migrations/v_system_alerts_cron_threshold_fix_20260623.sql)
SELECT 1; -- migration já aplicada diretamente
