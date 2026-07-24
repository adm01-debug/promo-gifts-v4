-- Migration 046: Dynamic enable RLS on all remaining public tables
--
-- Source: 200-commit audit — Supabase security advisor finding
-- Findings addressed: rls_disabled_in_public
--
-- ─── Background ──────────────────────────────────────────────────────────────
--
-- Supabase advisor (lint 0003_rls_disabled_in_public) flags tables in the
-- public schema where pg_class.relrowsecurity = false. Every application table
-- in public should have RLS enabled so that access is governed by explicit
-- policy rather than implicit role grants.
--
-- ─── What previous migrations cover ──────────────────────────────────────────
--
-- Migration 011 (20260716000011_sec_rls_enabled_no_policy.sql) addressed
-- rls_ENABLED_no_policy — 42 tables that had RLS ON but zero policies.
--
-- This migration is complementary: it addresses rls_DISABLED_in_public —
-- tables whose relrowsecurity is still false. Migrations 001-045 individually
-- enabled RLS on most tables they touched, but any table created without an
-- explicit ENABLE ROW LEVEL SECURITY clause, or where the clause was omitted,
-- still shows relrowsecurity = false.
--
-- ─── Safety considerations ────────────────────────────────────────────────────
--
-- Enabling RLS with NO policies makes the table inaccessible to non-superusers.
-- However in Supabase:
--   • service_role has BYPASSRLS attribute → full access regardless of policies
--   • postgres/supabase_admin (superusers) bypass RLS automatically
--   • Edge functions run as service_role → unaffected by RLS enable
--   • PostgREST (anon/authenticated) → denied if no policies exist
--
-- This B2B platform uses ProtectedRoute for ALL catalog routes (AppRoutes.tsx:175)
-- and relies on service_role for backend/edge-function data access. Tables in
-- the public schema that still lack RLS are assumed to be internal pipeline,
-- audit, or admin tables not directly queried by client-side PostgREST.
--
-- Tables WITH existing policies: enabling RLS activates those policies.
-- Tables WITHOUT existing policies: RLS enabled; service_role bypass applies;
--   a WARNING is emitted per table so developers can audit and add policies.
--
-- ─── Scope: regular tables + partitioned table parents ───────────────────────
--
-- relkind = 'r': regular tables
-- relkind = 'p': partitioned table parents
-- Partition children (relispartition = true) inherit parent RLS configuration;
-- the advisor typically flags them through the parent, so we include them.
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
-- The WHERE clause filters to NOT c.relrowsecurity, so tables that already have
-- RLS enabled are skipped. Exception handling per table protects against edge
-- cases (system-catalog tables, temporary tables, permission errors).

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 1: Enable RLS on all public tables with relrowsecurity = false
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r              RECORD;
  v_ok           int := 0;
  v_no_policy    int := 0;
  v_fail         int := 0;
BEGIN
  FOR r IN
    SELECT
      c.relname    AS tablename,
      c.relkind,
      (
        SELECT count(*)::int
        FROM pg_policies p
        WHERE p.schemaname = 'public'
          AND p.tablename  = c.relname
      ) AS policy_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')   -- regular tables and partitioned-table parents
      AND NOT c.relrowsecurity       -- RLS not yet enabled
    ORDER BY c.relname
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
      v_ok := v_ok + 1;

      IF r.policy_count = 0 THEN
        v_no_policy := v_no_policy + 1;
        RAISE WARNING '[046] % — RLS ENABLED, but NO policies (non-superuser access DENIED; service_role bypasses via BYPASSRLS)',
          r.tablename;
      ELSE
        RAISE NOTICE '✓ [046] Enabled RLS on % (% existing policies now active)',
          r.tablename, r.policy_count;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[046] ✗ Could not enable RLS on %: %', r.tablename, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[046] RLS enable sweep: enabled=%, of_which_no_policy=%, failed=%',
    v_ok, v_no_policy, v_fail;

  IF v_no_policy > 0 THEN
    RAISE WARNING '[046] % table(s) now have RLS enabled with ZERO policies — review and add appropriate policies per table',
      v_no_policy;
  END IF;

  IF v_fail > 0 THEN
    RAISE WARNING '[046] % table(s) could not have RLS enabled — check warnings above', v_fail;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2: Target-check known tables that historically lacked RLS
-- ═══════════════════════════════════════════════════════════════════════════════
-- These are tables identified in the audit as candidates for rls_disabled_in_public.
-- After Phase 1 they should all show relrowsecurity = true.

DO $$
DECLARE
  v_tbl        text;
  v_has_rls    boolean;
  v_tables     text[] := ARRAY[
    'products',
    'product_variants',
    'suppliers',
    'supplier_products_raw',
    'categories',
    'users',
    'organizations',
    'orders',
    'quotes',
    'notifications',
    'saved_filters',
    'entity_versions',
    'ai_insights_cache',
    'workspace_notifications',
    'discount_approval_requests',
    'product_badge_definitions'
  ];
BEGIN
  FOREACH v_tbl IN ARRAY v_tables
  LOOP
    SELECT c.relrowsecurity INTO v_has_rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = v_tbl;

    IF NOT FOUND THEN
      RAISE NOTICE '[046] % — not found in public schema (may not exist)', v_tbl;
    ELSIF v_has_rls THEN
      RAISE NOTICE '✓ [046] % — RLS confirmed enabled', v_tbl;
    ELSE
      RAISE WARNING '[046] % — RLS STILL DISABLED after sweep — investigate', v_tbl;
    END IF;
  END LOOP;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Validation: Count remaining tables with RLS disabled in public schema
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_total_tables   int;
  v_rls_enabled    int;
  v_rls_disabled   int;
  v_no_policy      int;
  r                RECORD;
BEGIN
  SELECT count(*) INTO v_total_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p');

  SELECT count(*) INTO v_rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity;

  v_rls_disabled := v_total_tables - v_rls_enabled;

  -- Tables with RLS enabled but no policies (access denied to non-superusers)
  SELECT count(*) INTO v_no_policy
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND c.relrowsecurity
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = c.relname
    );

  RAISE NOTICE '[046] Final state — public tables: total=%, rls_enabled=%, rls_disabled=%, rls_enabled_no_policy=%',
    v_total_tables, v_rls_enabled, v_rls_disabled, v_no_policy;

  IF v_rls_disabled = 0 THEN
    RAISE NOTICE '✓ [046] All % public tables have RLS enabled — rls_disabled_in_public cleared',
      v_total_tables;
  ELSE
    -- Log each remaining table for manual investigation
    FOR r IN
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
        AND NOT c.relrowsecurity
      ORDER BY c.relname
    LOOP
      RAISE WARNING '[046] Still disabled: % — investigate permissions or exclude if system table', r.relname;
    END LOOP;

    RAISE WARNING '[046] % of % public tables still have RLS disabled — rls_disabled_in_public NOT fully cleared',
      v_rls_disabled, v_total_tables;
  END IF;

  RAISE NOTICE 'Migration 046 complete — rls_disabled_in_public should clear on next advisor run.';
END;
$$;
