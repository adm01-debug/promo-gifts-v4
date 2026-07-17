-- Migration 051: Consolidate multiple permissive RLS policies per (table, cmd, roles)
--
-- Source: 200-commit audit — Supabase security/performance advisor finding
-- Findings addressed: multiple_permissive_policies (lint 0004)
--
-- ─── What the finding means ───────────────────────────────────────────────────
--
-- PostgreSQL evaluates ALL permissive policies for a given role+command with OR.
-- When a table has N permissive policies for the same role+command, PostgreSQL
-- must evaluate all N expressions for every row in the query result set, even
-- after one already granted access. This wastes N-1 evaluations per row.
--
-- The fix: combine multiple USING expressions with OR into a single policy.
-- Semantics are preserved: OR of permissive policies = permissive combined policy.
--
-- ─── Safety analysis ─────────────────────────────────────────────────────────
--
-- OR-combination of permissive policies is ALWAYS semantically equivalent:
--   {USING(A), USING(B)} ≡ {USING(A OR B)}
--   {WITH CHECK(A), WITH CHECK(B)} ≡ {WITH CHECK(A OR B)}
--
-- Special cases handled:
--   NULL qual/with_check: means "always true" — any policy with NULL makes
--     the combined condition true, so we use NULL for the combined policy.
--   Multi-role policies (roles has >1 element): skipped — rare edge case,
--     harder to reconstruct `TO role1, role2` syntax safely.
--   Empty roles `{}`: means TO PUBLIC — treated as string '{}'::text match.
--
-- auth.uid() / auth.role() / auth.jwt() are already wrapped as (SELECT ...)
-- by migrations 045 and 050 — the combined expressions inherit that wrapping.
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
-- After this migration, each (table, cmd, roles) group has exactly 1 permissive
-- policy. Re-running finds no groups with count > 1 — safe to apply again.
-- Combined policy names use the pattern: consolidated_<cmd>_<roles[1]>
-- If a consolidated policy already exists, it will be regenerated (same result).

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 1: Consolidate duplicate permissive policies
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r            RECORD;
  pol          RECORD;
  v_ok         int := 0;
  v_skip       int := 0;
  v_fail       int := 0;

  v_combined_qual   text;
  v_combined_check  text;
  v_has_null_qual   boolean;
  v_has_null_check  boolean;
  v_first_pname     text;
  v_combined_name   text;
  v_role_label      text;
  v_sql             text;

  -- Hold policy names to drop (collect before modifying catalog)
  v_policy_names    text[];
  v_pname           text;
BEGIN
  -- ── Outer loop: each (table, cmd, roles) group with 2+ permissive policies ──
  FOR r IN
    SELECT
      p.tablename,
      p.cmd,
      p.roles::text          AS roles_key,
      p.roles[1]             AS sole_role,   -- NULL if roles is empty array {}
      array_length(p.roles, 1) AS roles_count,
      count(*)               AS policy_count
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.permissive = 'PERMISSIVE'
    GROUP BY p.tablename, p.cmd, p.roles::text, p.roles[1], array_length(p.roles, 1)
    HAVING count(*) > 1
    ORDER BY p.tablename, p.cmd, p.roles::text
  LOOP
    -- Skip multi-role policies (roles has 2+ elements) — complex TO syntax
    IF r.roles_count > 1 THEN
      v_skip := v_skip + 1;
      RAISE NOTICE '[051] SKIP %.% roles=% — multi-role policy (roles_count=%); merge manually',
        r.tablename, r.cmd, r.roles_key, r.roles_count;
      CONTINUE;
    END IF;

    -- Collect all policy names and expressions for this group
    v_policy_names  := ARRAY[]::text[];
    v_combined_qual := NULL;
    v_combined_check := NULL;
    v_has_null_qual  := false;
    v_has_null_check := false;
    v_first_pname   := NULL;

    FOR pol IN
      SELECT p.policyname, p.qual, p.with_check
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename  = r.tablename
        AND p.cmd        = r.cmd
        AND p.roles::text = r.roles_key
        AND p.permissive = 'PERMISSIVE'
      ORDER BY p.policyname   -- deterministic ordering
    LOOP
      -- Track policy names for later DROP
      v_policy_names := array_append(v_policy_names, pol.policyname);

      IF v_first_pname IS NULL THEN
        v_first_pname := pol.policyname;
      END IF;

      -- Build combined qual
      IF pol.qual IS NULL THEN
        v_has_null_qual := true;   -- NULL = always true; whole OR is true
      ELSE
        IF NOT v_has_null_qual THEN
          -- Accumulate non-null quals with OR
          IF v_combined_qual IS NULL THEN
            v_combined_qual := '(' || pol.qual || ')';
          ELSE
            v_combined_qual := v_combined_qual || ' OR (' || pol.qual || ')';
          END IF;
        END IF;
      END IF;

      -- Build combined with_check
      IF pol.with_check IS NULL THEN
        v_has_null_check := true;
      ELSE
        IF NOT v_has_null_check THEN
          IF v_combined_check IS NULL THEN
            v_combined_check := '(' || pol.with_check || ')';
          ELSE
            v_combined_check := v_combined_check || ' OR (' || pol.with_check || ')';
          END IF;
        END IF;
      END IF;
    END LOOP;

    -- If any policy had NULL qual/check, the combined is NULL (always true)
    IF v_has_null_qual  THEN v_combined_qual  := NULL; END IF;
    IF v_has_null_check THEN v_combined_check := NULL; END IF;

    -- Build deterministic policy name
    -- roles_key: '{}' (public), '{authenticated}', '{anon}', etc.
    v_role_label := CASE
      WHEN r.roles_key = '{}'  THEN 'public'
      WHEN r.sole_role IS NOT NULL THEN r.sole_role
      ELSE 'multi'
    END;
    v_combined_name := 'consolidated_' || lower(r.cmd) || '_' || v_role_label;
    -- Truncate to max 63 chars for PostgreSQL identifier limit
    IF length(v_combined_name) > 63 THEN
      v_combined_name := left(v_combined_name, 63);
    END IF;

    -- ── Execute: DROP old policies, CREATE combined policy ──────────────────
    BEGIN
      -- Drop all old policies in this group
      FOREACH v_pname IN ARRAY v_policy_names
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_pname, r.tablename);
      END LOOP;

      -- Build CREATE POLICY statement
      -- Determine TO clause
      v_sql := format(
        'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR %s',
        v_combined_name, r.tablename, r.cmd
      );

      -- TO clause
      IF r.roles_key = '{}' THEN
        v_sql := v_sql || ' TO public';
      ELSE
        v_sql := v_sql || format(' TO %I', r.sole_role);
      END IF;

      -- USING clause
      IF v_combined_qual IS NOT NULL THEN
        v_sql := v_sql || ' USING (' || v_combined_qual || ')';
      END IF;

      -- WITH CHECK clause
      IF v_combined_check IS NOT NULL THEN
        v_sql := v_sql || ' WITH CHECK (' || v_combined_check || ')';
      END IF;

      EXECUTE v_sql;

      v_ok := v_ok + 1;
      RAISE NOTICE '✓ [051] Consolidated % policies → "%": table=%, cmd=%, roles=%',
        array_length(v_policy_names, 1), v_combined_name, r.tablename, r.cmd, r.roles_key;

    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[051] ✗ Could not consolidate %.% roles=%: %',
        r.tablename, r.cmd, r.roles_key, SQLERRM;

      -- Attempt to restore dropped policies (best-effort rollback)
      -- We cannot restore — they've been dropped. Log it clearly.
      RAISE WARNING '[051] ✗ IMPORTANT: Dropped policies for %.% roles=% may need manual restore: %',
        r.tablename, r.cmd, r.roles_key,
        array_to_string(v_policy_names, ', ');
    END;
  END LOOP;

  RAISE NOTICE '[051] Policy consolidation: merged=%, skipped=%, failed=%',
    v_ok, v_skip, v_fail;

  IF v_fail > 0 THEN
    RAISE WARNING '[051] % group(s) failed — check warnings above', v_fail;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2: Spot-check — tables known to have had multiple policies
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_tbl     text;
  v_cnt     int;
  v_tables  text[] := ARRAY[
    'products',
    'product_variants',
    'suppliers',
    'orders',
    'quotes',
    'organizations',
    'users',
    'notifications',
    'saved_filters',
    'entity_versions'
  ];
BEGIN
  FOREACH v_tbl IN ARRAY v_tables
  LOOP
    SELECT count(*) INTO v_cnt
    FROM (
      SELECT cmd, roles::text, count(*)
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_tbl
        AND permissive = 'PERMISSIVE'
      GROUP BY cmd, roles::text
      HAVING count(*) > 1
    ) sub;

    IF v_cnt = 0 THEN
      RAISE NOTICE '✓ [051] % — no remaining duplicate permissive policies', v_tbl;
    ELSE
      RAISE WARNING '[051] % — still has % group(s) with multiple permissive policies', v_tbl, v_cnt;
    END IF;
  END LOOP;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Validation: Count remaining (table, cmd, roles) groups with 2+ policies
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_remaining int;
  r           RECORD;
BEGIN
  SELECT count(*) INTO v_remaining
  FROM (
    SELECT tablename, cmd, roles::text
    FROM pg_policies
    WHERE schemaname = 'public'
      AND permissive = 'PERMISSIVE'
    GROUP BY tablename, cmd, roles::text
    HAVING count(*) > 1
  ) sub;

  IF v_remaining = 0 THEN
    RAISE NOTICE '✓ [051] No remaining (table, cmd, roles) groups with multiple permissive policies — multiple_permissive_policies cleared';
  ELSE
    RAISE WARNING '[051] % group(s) still have multiple permissive policies — investigate', v_remaining;

    FOR r IN
      SELECT tablename, cmd, roles::text AS roles_key, count(*) AS cnt
      FROM pg_policies
      WHERE schemaname = 'public'
        AND permissive = 'PERMISSIVE'
      GROUP BY tablename, cmd, roles::text
      HAVING count(*) > 1
      ORDER BY tablename, cmd
    LOOP
      RAISE WARNING '[051] Still multiple: table=% cmd=% roles=% count=%',
        r.tablename, r.cmd, r.roles_key, r.cnt;
    END LOOP;
  END IF;

  RAISE NOTICE 'Migration 051 complete — multiple_permissive_policies should clear on next advisor run.';
END;
$$;
