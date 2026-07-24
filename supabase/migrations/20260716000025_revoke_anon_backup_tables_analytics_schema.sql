-- Migration: Revoke anon access from backup tables and analytics schema
--
-- Problem (Supabase advisor: pg_graphql_anon_table_exposed):
--   Two categories of objects are wrongly accessible to the anon role:
--
--   A) Backup / archive / QA tables in the public schema
--      These are point-in-time snapshots created during migrations for safety.
--      They contain historical data and should never be publicly accessible.
--      They are NOT used by any app code (confirmed: grep src/ -r finds 0 references).
--
--      public._archive_product_ai_20260626
--      public._archive_product_seo_20260626
--      public._archive_supplier_price_tiers_20260626
--      public._bkp_kcvs_pre_normalize_20260624
--      public._bkp_kit_color_from_name_20260624
--      public._bkp_kit_packing_type_20260624
--      public._bkp_kit_pkg_material_20260624
--      public._qa_pct_results
--      public.backup_produto_ramo_atividade_20260625
--
--   B) analytics schema (4 materialized views)
--      analytics.categories_tree_visual
--      analytics.mv_product_cards
--      analytics.mv_product_compositions
--      analytics.mv_product_intelligence
--
--      The analytics schema provides reporting mirrors of public catalog MVs.
--      App code (src/) never directly queries the analytics schema — all access
--      goes through public schema views/RPCs. Revoking anon USAGE on the schema
--      removes all GraphQL and PostgREST exposure at once.
--
-- Fix:
--   (A) REVOKE SELECT FROM anon on each backup/archive/qa table (IF EXISTS guards)
--   (B) REVOKE USAGE ON SCHEMA analytics FROM anon (removes schema-level access)
--
-- Safety:
--   - All backup tables are snapshot-only; no foreign keys reference them
--   - analytics schema is not in PostgREST search_path config (public only)
--   - authenticated users retain their existing access to the analytics schema

-- ─── Part A: Backup / archive / QA tables ────────────────────────────────────
DO $$
DECLARE
  tbl text;
  backup_tables text[] := ARRAY[
    '_archive_product_ai_20260626',
    '_archive_product_seo_20260626',
    '_archive_supplier_price_tiers_20260626',
    '_bkp_kcvs_pre_normalize_20260624',
    '_bkp_kit_color_from_name_20260624',
    '_bkp_kit_packing_type_20260624',
    '_bkp_kit_pkg_material_20260624',
    '_qa_pct_results',
    'backup_produto_ramo_atividade_20260625'
  ];
BEGIN
  FOREACH tbl IN ARRAY backup_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = tbl
    ) THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', tbl);
      EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', tbl);
      RAISE NOTICE '✓ REVOKE ALL on public.% (anon + authenticated)', tbl;
    ELSE
      RAISE NOTICE '⚠ table public.% not found — skipping', tbl;
    END IF;
  END LOOP;
END;
$$;

-- ─── Part B: analytics schema — revoke anon schema-level access ───────────────
-- REVOKE USAGE prevents anon from resolving any object in the analytics schema
-- via PostgREST, GraphQL, or direct SQL query (they get "permission denied for schema").
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.schemata
    WHERE schema_name = 'analytics'
  ) THEN
    REVOKE USAGE ON SCHEMA analytics FROM anon;
    RAISE NOTICE '✓ REVOKE USAGE ON SCHEMA analytics FROM anon';
  ELSE
    RAISE NOTICE '⚠ schema analytics not found — skipping';
  END IF;
END;
$$;

-- ─── Validate ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  has_anon_usage boolean;
BEGIN
  -- Check analytics schema USAGE
  SELECT EXISTS (
    SELECT 1 FROM information_schema.role_usage_grants
    WHERE object_schema = 'analytics'
      AND object_name = 'analytics'
      AND grantee = 'anon'
      AND privilege_type = 'USAGE'
  ) INTO has_anon_usage;

  IF has_anon_usage THEN
    RAISE WARNING 'anon still has USAGE on analytics schema — check if schema exists';
  ELSE
    RAISE NOTICE '✓ anon no longer has USAGE on analytics schema (or schema absent)';
  END IF;
END;
$$;
