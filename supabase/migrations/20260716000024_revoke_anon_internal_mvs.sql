-- Migration: Revoke anon SELECT from internal materialized views
--
-- Problem (Supabase advisor: materialized_view_in_api):
--   4 materialized views are accessible to the `anon` role via the PostgREST
--   Data API. Three of these contain sensitive operational / BI data that
--   anonymous users have no business reading:
--
--     mv_stock_rupture_alert   — stock rupture alerts (EMA-based, operational)
--     mv_ema_kpi_by_level      — EMA KPI metrics by stock level (BI/internal)
--     mv_supplier_reliability  — supplier delivery reliability KPIs (BI/internal)
--
--   These views are used exclusively by authenticated admin users through
--   React hooks (useRuptureAlerts, useSupplierReliabilityServer). Anon access
--   is purely accidental and was never intended.
--
--   mv_product_leaf_category is intentionally kept anon-accessible because
--   v_products_public (public catalog, security_invoker=on) references it and
--   anon must be able to resolve the JOIN.
--
-- Fix:
--   REVOKE anon SELECT from the 3 sensitive MVs.
--   Verify that authenticated still has SELECT (dashboard must keep working).
--
-- Safety:
--   - All 3 MVs are read only by authenticated-role code (supabase client with JWT)
--   - PostgREST enforces the role grants; no app code passes anon to these MVs
--   - Materialized views don't support RLS natively — REVOKE is the correct fix
--   - PostgreSQL 17 (Supabase PG17): REVOKE is idempotent when combined with
--     IF EXISTS semantics in DO block validation below

-- ─── 1. mv_stock_rupture_alert ────────────────────────────────────────────────
REVOKE SELECT ON public.mv_stock_rupture_alert FROM anon;
-- Keep authenticated access (admin stock dashboard)
GRANT SELECT ON public.mv_stock_rupture_alert TO authenticated;

-- ─── 2. mv_ema_kpi_by_level ──────────────────────────────────────────────────
REVOKE SELECT ON public.mv_ema_kpi_by_level FROM anon;
GRANT SELECT ON public.mv_ema_kpi_by_level TO authenticated;

-- ─── 3. mv_supplier_reliability ──────────────────────────────────────────────
REVOKE SELECT ON public.mv_supplier_reliability FROM anon;
-- Keep authenticated access (useSupplierReliabilityServer)
GRANT SELECT ON public.mv_supplier_reliability TO authenticated;

-- ─── Validate ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  mv_name text;
  has_anon_select boolean;
BEGIN
  FOREACH mv_name IN ARRAY ARRAY[
    'mv_stock_rupture_alert',
    'mv_ema_kpi_by_level',
    'mv_supplier_reliability'
  ] LOOP
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = mv_name
        AND privilege_type = 'SELECT'
        AND grantee = 'anon'
    ) INTO has_anon_select;

    IF has_anon_select THEN
      RAISE EXCEPTION 'REVOKE FAILED: anon still has SELECT on public.%', mv_name;
    END IF;
    RAISE NOTICE '✓ anon SELECT revoked from public.%', mv_name;
  END LOOP;

  RAISE NOTICE 'mv_stock_rupture_alert, mv_ema_kpi_by_level, mv_supplier_reliability — anon revoked OK';
  RAISE NOTICE 'mv_product_leaf_category intentionally kept anon-accessible (public catalog JOIN)';
END;
$$;
