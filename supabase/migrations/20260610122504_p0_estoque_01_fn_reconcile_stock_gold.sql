-- P0: Reconciliação de estoque na Gold. Fonte de verdade: variant_supplier_sources.
-- Auditoria 2026-06-10: 3.931 variantes ativas (21%) com cache divergente da soma
-- das fontes; 515 products idem (dois escritores concorrentes: triggers + jobs).
-- Execução inicial: 3.797 variantes + 182 products corrigidos; divergência pós = 0.
CREATE OR REPLACE FUNCTION public.fn_reconcile_stock_gold(p_dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_var int := 0; v_prod int := 0;
  v_var_div int; v_prod_div int;
  v_t0 timestamptz := clock_timestamp();
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('fn_reconcile_stock_gold')::bigint) THEN
    RETURN jsonb_build_object('skipped','lock_ocupado');
  END IF;

  PERFORM set_config('app.bulk_import_mode','true', true);
  PERFORM set_config('app.write_source','reconcile', true);

  SELECT count(*) INTO v_var_div FROM (
    SELECT v.id FROM product_variants v
    LEFT JOIN variant_supplier_sources s ON s.variant_id=v.id AND s.is_active
    WHERE v.is_active
    GROUP BY v.id, v.stock_quantity
    HAVING COALESCE(v.stock_quantity,0) IS DISTINCT FROM COALESCE(sum(s.quantity),0)) z;
  SELECT count(*) INTO v_prod_div FROM (
    SELECT p.id FROM products p
    LEFT JOIN product_variants v ON v.product_id=p.id AND v.is_active
    WHERE p.is_active
    GROUP BY p.id, p.stock_quantity
    HAVING COALESCE(p.stock_quantity,0) IS DISTINCT FROM COALESCE(sum(v.stock_quantity),0)) z;

  IF p_dry_run THEN
    RETURN jsonb_build_object('dry_run', true,
      'variantes_divergentes', v_var_div, 'products_divergentes', v_prod_div);
  END IF;

  WITH agg AS (
    SELECT v.id, COALESCE(sum(s.quantity) FILTER (WHERE s.is_active),0) AS q
    FROM product_variants v
    LEFT JOIN variant_supplier_sources s ON s.variant_id=v.id
    WHERE v.is_active
    GROUP BY v.id),
  upd AS (
    UPDATE product_variants v SET stock_quantity = agg.q
    FROM agg WHERE v.id=agg.id AND COALESCE(v.stock_quantity,0) IS DISTINCT FROM agg.q
    RETURNING v.id)
  SELECT count(*) INTO v_var FROM upd;

  WITH agg AS (
    SELECT p.id, COALESCE(sum(v.stock_quantity) FILTER (WHERE v.is_active),0) AS q
    FROM products p
    LEFT JOIN product_variants v ON v.product_id=p.id
    WHERE p.is_active
    GROUP BY p.id),
  upd AS (
    UPDATE products p
       SET stock_quantity = agg.q,
           is_stockout = (agg.q <= 0),
           last_stock_update_at = now()
    FROM agg WHERE p.id=agg.id
      AND (COALESCE(p.stock_quantity,0) IS DISTINCT FROM agg.q
           OR p.is_stockout IS DISTINCT FROM (agg.q <= 0))
    RETURNING p.id)
  SELECT count(*) INTO v_prod FROM upd;

  RETURN jsonb_build_object(
    'variantes_divergentes_antes', v_var_div,
    'products_divergentes_antes', v_prod_div,
    'variantes_corrigidas', v_var,
    'products_corrigidos', v_prod,
    'segundos', round(extract(epoch FROM clock_timestamp()-v_t0)::numeric,1),
    'ts', now());
END $$;

REVOKE ALL ON FUNCTION public.fn_reconcile_stock_gold(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_reconcile_stock_gold(boolean) TO service_role;

SELECT cron.schedule('reconcile-stock-gold-daily', '10 5 * * *',
  'SELECT public.fn_reconcile_stock_gold(false);')
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='reconcile-stock-gold-daily');
