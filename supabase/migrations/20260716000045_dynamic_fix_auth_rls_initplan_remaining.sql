-- Migration 045: Dynamic auth_rls_initplan fix — ALL remaining public policies
--
-- Source: 200-commit audit — follow-up on migration T25 (20260512000001)
-- Findings addressed: auth_rls_initplan (all remaining)
--
-- ─── Why T25 is insufficient ─────────────────────────────────────────────────
--
-- T25 (20260512000001_t25_fix_auth_rls_initplan.sql) fixed 270 named policies
-- as of 2026-05-12. Since then, new migrations introduced bare auth.uid() in:
--
--   Missed by T25 (pre-existing but not in T25's list):
--     entity_versions   — "Users can insert versions" (Dec 2024)
--     saved_filters     — 5 SELECT/INSERT/UPDATE policies (Dec 2024)
--     notifications     — users_view_own/users_update_own (Jan 2025)
--     user_organizations — org admin policy (Jan 2025)
--     quotes/orders     — item policies via subqueries (Jan 2025)
--     (+ many more from 20250103 migration batch)
--
--   Created AFTER T25 (2026-05-12 < policy date):
--     product_badge_definitions — pbd_admin_insert/update/delete (2026-06-27)
--     discount_approval_requests — enable_read/insert/update_for_requesting_user
--                                  (2026-07-12, different names than T25 fixed)
--     workspace_notifications   — user_sees/can_insert/can_delete (2026-07-12)
--     ai_insights_cache         — "Users can view their own cached insights" (2026-07-15)
--
-- ─── Why auth_rls_initplan matters ───────────────────────────────────────────
--
-- auth.uid() without the (SELECT auth.uid()) wrapper is re-evaluated once per
-- row when a query touches an RLS-protected table. On tables with 10k+ rows
-- this causes 10k+ redundant function calls per query (init-plan re-evaluation
-- vs correlated subquery optimization). The (SELECT ...) wrapper forces the
-- planner to hoist the call to a constant once per query (init-plan).
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- ─── Strategy ────────────────────────────────────────────────────────────────
--
-- Query pg_policies dynamically to find ALL remaining policies in the public
-- schema where qual or with_check contains bare auth.uid() (i.e., not already
-- wrapped as (SELECT auth.uid())).
--
-- Replacement technique (safe triple-swap, avoids lookbehind regex):
--   1. Replace already-wrapped occurrences with a placeholder to preserve them
--   2. Replace remaining bare auth.uid() with (SELECT auth.uid())
--   3. Restore placeholder to (SELECT auth.uid())
--
-- ALTER POLICY ... USING/WITH CHECK is used (not DROP+CREATE) so grants and
-- other policy metadata are preserved. Exception handling per policy ensures
-- one failure does not abort the entire migration.
--
-- Idempotent: policies already using (SELECT auth.uid()) will not match the
-- filter condition (qual contains 'auth.uid()' but not '(SELECT auth.uid())').

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 1: Fix public schema RLS policies with bare auth.uid()
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r          RECORD;
  v_ok       int := 0;
  v_skip     int := 0;
  v_fail     int := 0;
  v_qual     text;
  v_check    text;
  v_sql      text;
  -- Placeholder that cannot appear in real SQL expressions
  c_ph       CONSTANT text := '<<AUTH_UID_ALREADY_WRAPPED>>';
BEGIN
  FOR r IN
    SELECT
      p.policyname,
      p.tablename,
      p.cmd,
      p.qual,
      p.with_check
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND (
        -- qual has bare auth.uid() (present but not yet wrapped)
        (p.qual       IS NOT NULL
          AND p.qual       LIKE '%auth.uid()%'
          AND p.qual       NOT LIKE '%(SELECT auth.uid())%')
        OR
        -- with_check has bare auth.uid()
        (p.with_check IS NOT NULL
          AND p.with_check LIKE '%auth.uid()%'
          AND p.with_check NOT LIKE '%(SELECT auth.uid())%')
      )
    ORDER BY p.tablename, p.policyname
  LOOP
    -- ── Safe triple-swap replacement ──────────────────────────────────────────
    -- Step 1: preserve already-wrapped occurrences with placeholder
    v_qual  := replace(r.qual,       '(SELECT auth.uid())', c_ph);
    v_check := replace(r.with_check, '(SELECT auth.uid())', c_ph);

    -- Step 2: wrap all remaining bare auth.uid()
    v_qual  := replace(v_qual,  'auth.uid()', '(SELECT auth.uid())');
    v_check := replace(v_check, 'auth.uid()', '(SELECT auth.uid())');

    -- Step 3: restore placeholder back to properly-wrapped form
    v_qual  := replace(v_qual,  c_ph, '(SELECT auth.uid())');
    v_check := replace(v_check, c_ph, '(SELECT auth.uid())');

    -- ── Build and execute ALTER POLICY ────────────────────────────────────────
    BEGIN
      IF r.qual IS NOT NULL AND r.with_check IS NOT NULL THEN
        -- UPDATE / ALL policies — both expressions apply
        EXECUTE format(
          'ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)',
          r.policyname, r.tablename, v_qual, v_check
        );
      ELSIF r.qual IS NOT NULL THEN
        -- SELECT / DELETE — only USING applies
        EXECUTE format(
          'ALTER POLICY %I ON public.%I USING (%s)',
          r.policyname, r.tablename, v_qual
        );
      ELSIF r.with_check IS NOT NULL THEN
        -- INSERT — only WITH CHECK applies
        EXECUTE format(
          'ALTER POLICY %I ON public.%I WITH CHECK (%s)',
          r.policyname, r.tablename, v_check
        );
      ELSE
        -- No-op: policy has neither qual nor with_check (e.g., permissive ALL with true)
        v_skip := v_skip + 1;
        CONTINUE;
      END IF;

      v_ok := v_ok + 1;
      RAISE NOTICE '✓ [045] Optimized %.% (%)', r.tablename, r.policyname, r.cmd;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[045] ✗ Could not optimize %.% (%): %',
        r.tablename, r.policyname, r.cmd, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[045] auth_rls_initplan sweep: optimized=%, skipped=%, failed=%',
    v_ok, v_skip, v_fail;

  IF v_fail > 0 THEN
    RAISE WARNING '[045] % policy/policies could not be optimized — check warnings above', v_fail;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2: Target-check specific tables known to be uncovered
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_tbl        text;
  v_bare_count int;
  v_tables     text[] := ARRAY[
    'entity_versions',
    'saved_filters',
    'product_badge_definitions',
    'discount_approval_requests',
    'workspace_notifications',
    'ai_insights_cache',
    'notifications',
    'user_organizations',
    'quotes',
    'orders'
  ];
BEGIN
  FOREACH v_tbl IN ARRAY v_tables
  LOOP
    SELECT count(*) INTO v_bare_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = v_tbl
      AND (
        (qual       LIKE '%auth.uid()%' AND qual       NOT LIKE '%(SELECT auth.uid())%')
        OR
        (with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(SELECT auth.uid())%')
      );

    IF v_bare_count = 0 THEN
      RAISE NOTICE '✓ [045] % — no remaining bare auth.uid() policies', v_tbl;
    ELSE
      RAISE WARNING '[045] % still has % bare auth.uid() policy/policies — investigate',
        v_tbl, v_bare_count;
    END IF;
  END LOOP;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Validation: count remaining bare auth.uid() in public schema policies
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_total_policies  int;
  v_bare_remaining  int;
  v_pct             numeric;
BEGIN
  -- Total policies in public schema
  SELECT count(*) INTO v_total_policies
  FROM pg_policies
  WHERE schemaname = 'public';

  -- Remaining bare auth.uid() (not wrapped)
  SELECT count(*) INTO v_bare_remaining
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      (qual       LIKE '%auth.uid()%' AND qual       NOT LIKE '%(SELECT auth.uid())%')
      OR
      (with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(SELECT auth.uid())%')
    );

  v_pct := CASE WHEN v_total_policies > 0
                THEN round((v_bare_remaining::numeric / v_total_policies) * 100, 1)
                ELSE 0 END;

  IF v_bare_remaining = 0 THEN
    RAISE NOTICE '✓ [045] All % public policies use (SELECT auth.uid()) — auth_rls_initplan cleared',
      v_total_policies;
  ELSIF v_bare_remaining <= 5 THEN
    RAISE NOTICE '[045] % of % public policies still bare (%.%% — investigate remaining)',
      v_bare_remaining, v_total_policies, v_pct / 10, v_pct % 10;

    -- Log which ones remain
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN
        SELECT tablename, policyname, cmd
        FROM pg_policies
        WHERE schemaname = 'public'
          AND (
            (qual       LIKE '%auth.uid()%' AND qual       NOT LIKE '%(SELECT auth.uid())%')
            OR
            (with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(SELECT auth.uid())%')
          )
        ORDER BY tablename, policyname
      LOOP
        RAISE WARNING '[045] Still bare: %.% (%)', r.tablename, r.policyname, r.cmd;
      END LOOP;
    END;
  ELSE
    RAISE WARNING '[045] % of % public policies still have bare auth.uid() — auth_rls_initplan NOT cleared',
      v_bare_remaining, v_total_policies;
  END IF;

  RAISE NOTICE 'Migration 045 complete — auth_rls_initplan should clear on next advisor run.';
END;
$$;
