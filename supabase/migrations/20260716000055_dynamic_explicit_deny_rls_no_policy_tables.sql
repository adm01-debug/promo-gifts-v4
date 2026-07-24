-- Migration 055: Add explicit deny policy to tables with RLS on but zero policies
--
-- Source: 200-commit audit — Supabase security advisor finding
-- Findings addressed: rls_enabled_no_policy (lint 0002)
--
-- ─── Background ──────────────────────────────────────────────────────────────
--
-- Migration 046 enabled RLS on all remaining public tables and emitted warnings
-- for tables that had zero policies. Migration 011 earlier addressed 42 tables
-- that had RLS on with zero policies by adding SELECT/INSERT/UPDATE/DELETE
-- policies. However, some tables that had RLS disabled before migration 046
-- may still have RLS enabled with zero policies after the sweep.
--
-- The Supabase advisor (lint 0002) flags any table with relrowsecurity = true
-- but pg_policies count = 0. These tables need at least one policy to silence
-- the advisor.
--
-- ─── What "RLS enabled, zero policies" means for access ──────────────────────
--
-- PostgreSQL: when RLS is enabled and NO policies exist:
--   • Non-superusers → 0 rows visible / 0 rows writable (deny by default)
--   • Supabase service_role (BYPASSRLS) → full access regardless
--   • Supabase postgres user (superuser) → full access regardless
--
-- So functionally, these tables are already inaccessible to anon/authenticated
-- PostgREST roles — RLS is doing its job via the absence of permissive policies.
--
-- ─── The fix: explicit RESTRICTIVE deny policy ────────────────────────────────
--
-- Adding an explicit RESTRICTIVE policy USING (false) to each zero-policy table:
--   1. Clears the lint (table now has ≥1 policy)
--   2. Does NOT change actual access behaviour (already denied)
--   3. Makes intent explicit: "this table is intentionally inaccessible via
--      PostgREST; only service_role/superuser access is expected"
--   4. Prevents accidental future policy additions from granting access without
--      conscious review (RESTRICTIVE policies AND with PERMISSIVE ones)
--
-- Policy name: "internal_deny_direct_access"
-- This name clearly communicates intent to future developers.
--
-- ─── Exclusions ──────────────────────────────────────────────────────────────
--
-- Tables that already have ≥1 policy are excluded (they don't need this fix).
-- Partitioned table parents where the RLS config is inherited by children —
-- included since the parent itself needs the policy to satisfy the lint.
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
-- CREATE POLICY IF NOT EXISTS + outer NOT EXISTS check means re-running is safe.
-- Tables that already have the deny policy are skipped automatically.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 1: Add explicit deny policy to zero-policy RLS tables
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r            RECORD;
  v_ok         int := 0;
  v_already    int := 0;
  v_fail       int := 0;
BEGIN
  FOR r IN
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')    -- regular tables and partitioned parents
      AND c.relrowsecurity = true     -- RLS is enabled
      AND NOT EXISTS (
        SELECT 1
        FROM pg_policies p
        WHERE p.schemaname = 'public'
          AND p.tablename = c.relname
      )
    ORDER BY c.relname
  LOOP
    BEGIN
      -- The policy name is intentionally descriptive
      EXECUTE format(
        $sql$
          CREATE POLICY internal_deny_direct_access
          ON public.%I
          AS RESTRICTIVE
          TO public
          USING (false)
        $sql$,
        r.tablename
      );
      v_ok := v_ok + 1;
      RAISE NOTICE '✓ [055] Added explicit deny policy to % (was RLS-on, 0 policies — intent now explicit)',
        r.tablename;
    EXCEPTION
      WHEN duplicate_object THEN
        v_already := v_already + 1;
        RAISE NOTICE '[055] SKIP %: deny policy already exists', r.tablename;
      WHEN OTHERS THEN
        v_fail := v_fail + 1;
        RAISE WARNING '[055] ✗ Could not add deny policy to %: %', r.tablename, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[055] Deny-policy sweep: added=%, already_had_policy=%, failed=%',
    v_ok, v_already, v_fail;

  IF v_fail > 0 THEN
    RAISE WARNING '[055] % table(s) could not get a deny policy — check warnings above', v_fail;
  END IF;

  IF v_ok = 0 AND v_already = 0 THEN
    RAISE NOTICE '[055] No zero-policy RLS tables found — rls_enabled_no_policy was already clear';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2: Validate — count remaining tables with RLS on and zero policies
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_remaining int;
  r           RECORD;
BEGIN
  SELECT count(*) INTO v_remaining
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND c.relrowsecurity = true
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = c.relname
    );

  IF v_remaining = 0 THEN
    RAISE NOTICE '✓ [055] All RLS-enabled public tables now have ≥1 policy — rls_enabled_no_policy cleared';
  ELSE
    RAISE WARNING '[055] % public table(s) still have RLS enabled with zero policies — investigate', v_remaining;

    FOR r IN
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
        AND c.relrowsecurity = true
        AND NOT EXISTS (
          SELECT 1 FROM pg_policies p
          WHERE p.schemaname = 'public' AND p.tablename = c.relname
        )
      ORDER BY c.relname
    LOOP
      RAISE WARNING '[055] Still zero policies: %', r.relname;
    END LOOP;
  END IF;

  -- Summary: how many tables have the explicit deny policy
  DECLARE
    v_deny_count int;
  BEGIN
    SELECT count(*) INTO v_deny_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname = 'internal_deny_direct_access';

    RAISE NOTICE '[055] Tables with explicit internal_deny_direct_access policy: %', v_deny_count;
  END;

  RAISE NOTICE 'Migration 055 complete — rls_enabled_no_policy should clear on next advisor run.';
END;
$$;
