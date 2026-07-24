-- P0 SEGURANÇA (auditoria 2026-06-10):
-- 1) anon lia o Bronze inteiro (payload com custos) via spr_select_anon
-- 2) anon tinha SELECT em products.cost_price / ipi_rate (a view v_products_public
--    já anula esses campos — o vazamento era na TABELA)
-- 3) ~93 funções de pipeline SECURITY DEFINER executáveis por anon (via PUBLIC)
-- 4) tabelas _bkp/_deprecated expostas na API/GraphQL

DROP POLICY IF EXISTS spr_select_anon ON public.supplier_products_raw;

REVOKE SELECT (cost_price) ON public.products FROM anon;
REVOKE SELECT (ipi_rate)   ON public.products FROM anon;

DO $$
DECLARE r RECORD; v_sig text;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prokind = 'f'
      AND (p.proname LIKE E'fn\\_%'
           OR p.proname IN ('insert_supplier_product_raw','upsert_supplier_stock_raw',
                            'upsert_supplier_customization_raw','process_supplier_product',
                            'process_supplier_product_batch','process_pending_batches'))
      AND p.proname NOT LIKE E'fn\\_video\\_queue\\_%'
  LOOP
    v_sig := r.oid::regprocedure::text;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', v_sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', v_sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_sig);
  END LOOP;
END $$;

ALTER TABLE IF EXISTS public._deprecated_silver_products_20260606        SET SCHEMA backup;
ALTER TABLE IF EXISTS public._deprecated_silver_variants_20260606        SET SCHEMA backup;
ALTER TABLE IF EXISTS public._deprecated_silver_images_queue_20260606    SET SCHEMA backup;
ALTER TABLE IF EXISTS public.produtos_padronizacao_bkp_20260604          SET SCHEMA backup;
ALTER TABLE IF EXISTS public.produtos_padronizacao_variantes_bkp_20260604 SET SCHEMA backup;
ALTER TABLE IF EXISTS public._backup_produtos_padronizacao_20260604      SET SCHEMA backup;
ALTER TABLE IF EXISTS public._bkp_asia_raw_pre_fix_referencia            SET SCHEMA backup;
ALTER TABLE IF EXISTS public._bkp_asia_raw_pre_reload_20260606           SET SCHEMA backup;
