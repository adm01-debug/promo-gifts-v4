-- Migration 040: Fix materialized_view_in_api + anon SECURITY DEFINER functions
--
-- Source: 200-commit audit + security advisor findings
-- Findings addressed: 3
--   1) materialized_view_in_api — public.mv_product_leaf_category
--   2) anon_security_definer_function_executable — public.fn_rpc_exists
--   3) anon_security_definer_function_executable — public.fn_get_product_intelligence_all
--
-- ─── Finding 1: mv_product_leaf_category accessible to anon/authenticated ─────
--
-- public.mv_product_leaf_category is a materialized view that maps products to
-- their deepest category (product_id, leaf_category_id, leaf_category_name, etc).
-- Materialized views do NOT enforce RLS — any direct query returns ALL rows.
--
-- The only anon-accessible view that queries this MV is public.v_products_public,
-- which is currently SECURITY INVOKER (runs as the calling role).
--
-- Fix strategy:
--   a) Convert v_products_public to SECURITY DEFINER (security_invoker=false)
--      so it runs as its owner (postgres/superuser) — anon/authenticated callers
--      no longer need direct SELECT on the underlying MV.
--   b) REVOKE SELECT on mv_product_leaf_category from anon, authenticated.
--
-- Safety analysis:
--   - v_products_public WHERE clause: p.is_deleted IS NOT TRUE AND p.is_active = true
--   - products_anon_read RLS: is_active = true AND is_deleted IS NOT TRUE
--   - These are equivalent, so SECURITY DEFINER produces the same row set as
--     SECURITY INVOKER + RLS.
--   - v_products_public_test also references the MV but anon cannot SELECT from it
--     (no GRANT) — that view is unaffected by this change.
--
-- ─── Finding 2: fn_rpc_exists callable by anon ───────────────────────────────
--
-- public.fn_rpc_exists(_fname text) is a SECURITY DEFINER function that probes
-- pg_proc to check if a named function exists in the public schema. Allowing
-- anonymous callers to enumerate available RPC functions is a schema-exposure risk.
-- The function is used by authenticated frontend code for graceful feature degradation.
-- Anon users do not need schema introspection capability.
--
-- Fix: REVOKE EXECUTE FROM anon. Authenticated callers retain access.
--
-- ─── Finding 3: fn_get_product_intelligence_all callable by anon ─────────────
--
-- public.fn_get_product_intelligence_all() returns inventory intelligence data:
--   product_id, turnover_score, avg_depletion_7d/30d, abc_classification,
--   total_depleted_30d/90d
-- This is internal business intelligence (stock velocity, ABC analysis). Exposing
-- depletion rates and ABC classification to anonymous users leaks competitive
-- inventory metrics. The function is used in authenticated admin/intelligence views.
--
-- Fix: REVOKE EXECUTE FROM anon. Authenticated callers retain access.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1) Fix materialized_view_in_api: convert v_products_public to SECURITY DEFINER
--    then revoke direct MV access from API roles
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- a) Change v_products_public to SECURITY DEFINER mode
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'v_products_public' AND c.relkind = 'v'
  ) THEN
    ALTER VIEW public.v_products_public SET (security_invoker = false);
    RAISE NOTICE '✓ [materialized_view_in_api] v_products_public converted to SECURITY DEFINER';
  ELSE
    RAISE NOTICE '- v_products_public not found — skipping view alter';
  END IF;

  -- b) Revoke direct API access to the materialized view
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'mv_product_leaf_category' AND c.relkind = 'm'
  ) THEN
    REVOKE SELECT ON public.mv_product_leaf_category FROM anon, authenticated;
    RAISE NOTICE '✓ [materialized_view_in_api] REVOKE SELECT ON mv_product_leaf_category FROM anon, authenticated';
  ELSE
    RAISE NOTICE '- public.mv_product_leaf_category not found — skipping revoke';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2) Revoke anon execute on fn_rpc_exists (schema introspection)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_rpc_exists'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.fn_rpc_exists(text) FROM anon;
    RAISE NOTICE '✓ [anon_security_definer_function_executable] REVOKE EXECUTE ON fn_rpc_exists FROM anon';
  ELSE
    RAISE NOTICE '- public.fn_rpc_exists not found — skipping';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3) Revoke anon execute on fn_get_product_intelligence_all (internal inventory metrics)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_get_product_intelligence_all'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.fn_get_product_intelligence_all() FROM anon;
    RAISE NOTICE '✓ [anon_security_definer_function_executable] REVOKE EXECUTE ON fn_get_product_intelligence_all FROM anon';
  ELSE
    RAISE NOTICE '- public.fn_get_product_intelligence_all not found — skipping';
  END IF;
END;
$$;

-- ─── Validation ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  view_invoker    text;
  anon_mv_select  boolean;
  anon_rpc        boolean;
  anon_intel      boolean;
BEGIN
  -- 1) Verify v_products_public is now SECURITY DEFINER
  SELECT opt INTO view_invoker
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL unnest(c.reloptions) AS opt
  WHERE n.nspname = 'public' AND c.relname = 'v_products_public' AND c.relkind = 'v'
    AND opt LIKE 'security_invoker%';

  IF view_invoker IS NULL OR view_invoker = 'security_invoker=on' THEN
    RAISE WARNING 'v_products_public may still be SECURITY INVOKER: %', view_invoker;
  ELSE
    RAISE NOTICE '✓ v_products_public security setting: %', view_invoker;
  END IF;

  -- 2) Verify anon cannot select from mv_product_leaf_category
  SELECT has_table_privilege('anon', 'public.mv_product_leaf_category', 'SELECT')
  INTO anon_mv_select;

  IF anon_mv_select THEN
    RAISE WARNING 'anon still has SELECT on mv_product_leaf_category';
  ELSE
    RAISE NOTICE '✓ anon no longer has SELECT on mv_product_leaf_category';
  END IF;

  -- 3) Verify fn_rpc_exists revoked from anon
  SELECT has_function_privilege('anon', 'public.fn_rpc_exists(text)', 'EXECUTE')
  INTO anon_rpc;

  IF anon_rpc THEN
    RAISE WARNING 'anon still has EXECUTE on fn_rpc_exists';
  ELSE
    RAISE NOTICE '✓ anon no longer has EXECUTE on fn_rpc_exists';
  END IF;

  -- 4) Verify fn_get_product_intelligence_all revoked from anon
  SELECT has_function_privilege('anon', 'public.fn_get_product_intelligence_all()', 'EXECUTE')
  INTO anon_intel;

  IF anon_intel THEN
    RAISE WARNING 'anon still has EXECUTE on fn_get_product_intelligence_all';
  ELSE
    RAISE NOTICE '✓ anon no longer has EXECUTE on fn_get_product_intelligence_all';
  END IF;

  RAISE NOTICE 'Migration 040 complete — 3 security findings addressed.';
END;
$$;
