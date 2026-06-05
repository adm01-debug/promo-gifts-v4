-- Correção (auditoria PR #659): a migration 20260604231642 reintroduziu
-- `VACUUM ANALYZE` no job de cron 'vacuum-analyze-weekly'. pg_cron executa o
-- comando multi-statement dentro de um bloco de transação, e VACUUM não pode
-- rodar em transaction block -> o job falharia toda semana (sáb 02:00), como
-- já havia sido corrigido em 20260602_002_fix_cron_jobs_never_ran.sql.
-- Recriamos o job com ANALYZE-only (atualiza estatísticas dentro da transação).
-- O VACUUM real é coberto por autovacuum (tuning em 20260604231642 /
-- 20260605001917) e pode ser feito manualmente via Dashboard quando necessário.
DO $$
BEGIN
  PERFORM cron.unschedule('vacuum-analyze-weekly');
EXCEPTION WHEN OTHERS THEN
  NULL; -- job pode não existir em replay limpo; será (re)criado abaixo
END $$;

SELECT cron.schedule('vacuum-analyze-weekly', '0 2 * * 6', $job$
    ANALYZE public.product_images;
    ANALYZE public.product_relationships;
    ANALYZE public.products;
    ANALYZE public.product_variants;
    ANALYZE public.supplier_import_batches;
    ANALYZE public.product_category_assignments;
    ANALYZE public.admin_audit_log;
    ANALYZE public.frontend_telemetry;
    ANALYZE public.supplier_products_raw;
    ANALYZE public.supplier_products_raw_history;
$job$);