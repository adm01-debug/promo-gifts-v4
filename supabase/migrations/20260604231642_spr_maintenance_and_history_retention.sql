-- P3: manutenção e retenção.

-- 1) fillfactor + autovacuum mais agressivo. Como muitos UPDATEs tocam colunas
--    indexadas, deixar folga na página favorece HOT-updates e reduz bloat de índice.
ALTER TABLE public.supplier_products_raw
  SET (fillfactor = 90,
       autovacuum_vacuum_scale_factor = 0.05,
       autovacuum_analyze_scale_factor = 0.02);

ALTER TABLE public.supplier_products_raw_history
  SET (autovacuum_vacuum_scale_factor = 0.1);

-- 2) Retenção do histórico (cresce a cada mudança de content_hash, sem limite).
--    Mantém 90 dias.
CREATE OR REPLACE FUNCTION public.fn_purge_spr_history(p_keep_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.supplier_products_raw_history
   WHERE captured_at < now() - make_interval(days => p_keep_days);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END $$;

-- Agenda diária da retenção (03:30).
SELECT cron.schedule('purge-spr-history-daily', '30 3 * * *',
  $$SELECT public.fn_purge_spr_history(90);$$);

-- 3) Inclui as tabelas raw + history no VACUUM ANALYZE semanal existente (jobid/nome
--    'vacuum-analyze-weekly'). Reaproveita o mesmo job por nome (idempotente).
SELECT cron.schedule('vacuum-analyze-weekly', '0 2 * * 6', $$
    VACUUM ANALYZE public.product_images;
    VACUUM ANALYZE public.product_relationships;
    VACUUM ANALYZE public.products;
    VACUUM ANALYZE public.product_variants;
    VACUUM ANALYZE public.supplier_import_batches;
    VACUUM ANALYZE public.product_category_assignments;
    VACUUM ANALYZE public.admin_audit_log;
    VACUUM ANALYZE public.frontend_telemetry;
    VACUUM ANALYZE public.supplier_products_raw;
    VACUUM ANALYZE public.supplier_products_raw_history;
    $$);
