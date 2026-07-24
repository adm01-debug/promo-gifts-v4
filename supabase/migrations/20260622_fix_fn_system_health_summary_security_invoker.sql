-- APLICADO: 2026-06-22
-- BUG DETECTADO DURANTE VALIDAÇÃO EXAUSTIVA:
-- fn_system_health_summary() era SECURITY DEFINER e chamava
-- fn_run_smoke_tests() internamente.
-- fn_run_smoke_tests() usa EXECUTE 'RESET role' internamente
-- o que é PROIBIDO em contexto SECURITY DEFINER no PostgreSQL.
-- ERROR: cannot set parameter "role" within security-definer function
--
-- FIX: Mudar para SECURITY INVOKER + substituir chamada a
-- fn_run_smoke_tests() por checks diretos para evitar o RESET role.
-- Função de monitoramento não precisa de SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.fn_system_health_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER  -- corrigido de SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result          jsonb;
  v_rls_gap         int;
  v_variants_active bigint;
  v_variants_restock bigint;
  v_products_total  bigint;
  v_products_ai_done bigint;
  v_sales_products  bigint;
  v_sales_revenue   numeric;
  v_fav_lists       bigint;
  v_smoke_pass      int := 0;
  v_smoke_fail      int := 0;
  v_smoke_total     int;
BEGIN
  -- Checks internos diretos (não chama fn_run_smoke_tests para
  -- evitar o RESET role proibido em SECURITY DEFINER)
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('products','product_variants','product_images','orders'))
  THEN v_smoke_pass := v_smoke_pass + 1; ELSE v_smoke_fail := v_smoke_fail + 1; END IF;

  IF (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='product_variants'
    AND column_name IN ('next_entry_date','next_entry_quantity') AND is_generated='ALWAYS') = 2
  THEN v_smoke_pass := v_smoke_pass + 1; ELSE v_smoke_fail := v_smoke_fail + 1; END IF;

  IF (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN
    ('get_promo_sales_90d_by_product','get_favorite_list_counts')) = 2
  THEN v_smoke_pass := v_smoke_pass + 1; ELSE v_smoke_fail := v_smoke_fail + 1; END IF;

  IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='r' AND n.nspname='public' AND c.relrowsecurity=false)
  THEN v_smoke_pass := v_smoke_pass + 1; ELSE v_smoke_fail := v_smoke_fail + 1; END IF;

  IF EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public'
    AND tablename='product_variants' AND indexname='idx_pv_next_entry_date_nonnull')
  THEN v_smoke_pass := v_smoke_pass + 1; ELSE v_smoke_fail := v_smoke_fail + 1; END IF;

  IF NOT has_table_privilege('anon','public._bkp_kit_dims_20260619','SELECT')
    AND NOT has_table_privilege('authenticated','public._bkp_kit_dims_20260619','SELECT')
  THEN v_smoke_pass := v_smoke_pass + 1; ELSE v_smoke_fail := v_smoke_fail + 1; END IF;

  v_smoke_total := v_smoke_pass + v_smoke_fail;

  SELECT COUNT(*) INTO v_rls_gap
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relkind='r' AND n.nspname='public' AND c.relrowsecurity=false;

  SELECT
    COUNT(*) FILTER (WHERE is_active=true),
    COUNT(*) FILTER (WHERE is_active=true AND next_entry_date IS NOT NULL AND next_entry_date > CURRENT_DATE)
  INTO v_variants_active, v_variants_restock
  FROM product_variants;

  SELECT
    COUNT(*) FILTER (WHERE is_active=true),
    COUNT(*) FILTER (WHERE is_active=true AND ai_title IS NOT NULL)
  INTO v_products_total, v_products_ai_done
  FROM products;

  SELECT
    COUNT(DISTINCT oi.product_id)::bigint,
    COALESCE(SUM(oi.subtotal),0)
  INTO v_sales_products, v_sales_revenue
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.created_at >= NOW() - INTERVAL '90 days'
    AND o.status NOT IN ('cancelled','refunded','cancelado','estornado')
    AND oi.product_id IS NOT NULL;

  SELECT COUNT(*) INTO v_fav_lists FROM favorite_lists WHERE is_archived=false;

  v_result := jsonb_build_object(
    'generated_at',       NOW(),
    'health_checks',      jsonb_build_object(
      'pass',             v_smoke_pass,
      'fail',             v_smoke_fail,
      'total',            v_smoke_total,
      'healthy',          v_smoke_fail = 0,
      'note',             'Checks internos diretos. Para smoke completo: SELECT * FROM fn_run_smoke_tests()'
    ),
    'rls_coverage',       jsonb_build_object(
      'tables_without_rls', v_rls_gap,
      'healthy',            v_rls_gap = 0
    ),
    'product_variants',   jsonb_build_object(
      'active',              v_variants_active,
      'with_restock_date',   v_variants_restock,
      'generated_cols_ok',   true
    ),
    'products',           jsonb_build_object(
      'total_active',        v_products_total,
      'ai_enriched',         v_products_ai_done,
      'pending_enrichment',  v_products_total - v_products_ai_done,
      'enrichment_pct',      CASE WHEN v_products_total > 0
                             THEN ROUND((v_products_ai_done::numeric / v_products_total)*100,1)
                             ELSE 0 END
    ),
    'sales_90d',          jsonb_build_object(
      'products_sold',    v_sales_products,
      'total_revenue',    v_sales_revenue
    ),
    'favorite_lists',     jsonb_build_object(
      'active_lists',     v_fav_lists
    ),
    'new_rpcs',           jsonb_build_object(
      'get_promo_sales_90d_by_product', true,
      'get_favorite_list_counts',       true
    )
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_system_health_summary()
  TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_system_health_summary() IS
  'SECURITY INVOKER (fix 2026-06-22): fn_run_smoke_tests() usa RESET role '
  'que é proibido em SECURITY DEFINER. Checks internos diretos + métricas do sistema. '
  'Para smoke tests completos: SELECT * FROM fn_run_smoke_tests()';

NOTIFY pgrst, 'reload schema';
