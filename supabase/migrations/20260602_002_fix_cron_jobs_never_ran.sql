-- ============================================================
-- MIGRATION 002: Corrige cron jobs que nunca executaram
-- Auditoria: 02/06/2026 — Claude Sonnet 4
-- vacuum-analyze-weekly e cleanup-log-tables-weekly = last_run NULL
-- ============================================================

-- Recriar vacuum-analyze-weekly
SELECT cron.unschedule('vacuum-analyze-weekly');

SELECT cron.schedule(
  'vacuum-analyze-weekly',
  '0 2 * * 6',
  $$
    ANALYZE public.product_images;
    ANALYZE public.product_relationships;
    ANALYZE public.products;
    ANALYZE public.product_variants;
    ANALYZE public.supplier_import_batches;
    ANALYZE public.product_category_assignments;
    ANALYZE public.admin_audit_log;
    ANALYZE public.frontend_telemetry;
    ANALYZE public.variant_supplier_sources;
    ANALYZE public.supplier_products_raw;
  $$
);
-- NOTA: VACUUM real nao pode rodar em transaction block via cron.
-- ANALYZE aqui atualiza estatisticas sem precisar de VACUUM.
-- Execute VACUUM ANALYZE manualmente via Dashboard nas tabelas criticas.

-- Recriar cleanup-log-tables-weekly
SELECT cron.unschedule('cleanup-log-tables-weekly');

SELECT cron.schedule(
  'cleanup-log-tables-weekly',
  '0 3 * * 0',
  $$ SELECT public.fn_cleanup_log_tables(); $$
);

-- Novo: log-retention-daily (complementar)
SELECT cron.schedule(
  'log-retention-daily',
  '0 4 * * *',
  $$ SELECT public.fn_cleanup_log_tables(); $$
);
