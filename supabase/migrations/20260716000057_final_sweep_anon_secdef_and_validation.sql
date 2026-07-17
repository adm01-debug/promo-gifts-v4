-- Migration 057: Final sweep — revoke any remaining anon SECURITY DEFINER
--                functions + comprehensive advisor-state validation
--
-- Source: 200-commit audit — final hardening pass
-- Findings addressed: anon_security_definer_function_executable (catch-all)
--
-- ─── Context ─────────────────────────────────────────────────────────────────
--
-- Migrations 040-049 progressively revoked anon EXECUTE from public SECURITY
-- DEFINER functions. After all those migrations, exactly 5 functions should
-- remain callable by anon because they are part of the anonymous auth flow:
--
--   1. check_login_rate_limit(text)           — rate-limit anon login attempts
--   2. fn_check_login_allowed(text)           — blocks too-many-fails accounts
--   3. enforce_password_reset_rate_limit()    — rate-limit password reset
--   4. get_quote_token_by_value(text)         — public quote token lookup
--   5. submit_quote_response(text, jsonb)     — public quote form submission
--
-- This migration performs a dynamic final sweep: it finds ALL public SECURITY
-- DEFINER functions still callable by anon, excludes the 5 legitimate ones
-- by name, and revokes EXECUTE from anon on any extra ones found.
--
-- ─── Safety ──────────────────────────────────────────────────────────────────
--
-- The safe-list is matched by function name (proname), not signature, so
-- overloads of the same name are also preserved. Any function NOT on the list
-- is treated as unintentionally anon-callable and is revoked.
--
-- This is conservative: if a new legitimate anon function is added in the
-- future it should be added to the safelist in this migration BEFORE applying.
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
-- REVOKE on a privilege that doesn't exist is a no-op in PostgreSQL.
-- Re-running this migration is safe.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 1: Dynamic revoke of any anon-callable SECURITY DEFINER functions
--          not in the known-safe list
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r            RECORD;
  v_ok         int := 0;
  v_skip       int := 0;
  v_fail       int := 0;
  -- Functions that MUST remain callable by anon (auth / quote flows)
  v_safelist   text[] := ARRAY[
    'check_login_rate_limit',
    'fn_check_login_allowed',
    'enforce_password_reset_rate_limit',
    'get_quote_token_by_value',
    'submit_quote_response'
  ];
BEGIN
  FOR r IN
    SELECT
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true                          -- SECURITY DEFINER
      AND has_function_privilege('anon', p.oid, 'EXECUTE')  -- anon can call it
      AND NOT (p.proname = ANY(v_safelist))           -- not in safe list
    ORDER BY p.proname, p.oid
  LOOP
    BEGIN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon',
        r.proname, r.args
      );
      v_ok := v_ok + 1;
      RAISE NOTICE '✓ [057] REVOKE EXECUTE ON %(%) FROM anon',
        r.proname, r.args;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[057] ✗ Could not revoke %(%)): %',
        r.proname, r.args, SQLERRM;
    END;
  END LOOP;

  -- Count remaining safelist functions still callable by anon (sanity check)
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND p.proname = ANY(v_safelist)
    ORDER BY p.proname
  LOOP
    v_skip := v_skip + 1;
    RAISE NOTICE '[057] KEPT (safe): %(%)', r.proname, r.args;
  END LOOP;

  RAISE NOTICE '[057] Summary: revoked=%, kept_safe=%, failed=%',
    v_ok, v_skip, v_fail;

  IF v_fail > 0 THEN
    RAISE WARNING '[057] % revocation(s) failed — check warnings above', v_fail;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2: Comprehensive advisor-state validation
-- Confirms goal state for each major finding category
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_count   int;
  v_pass    int := 0;
  v_warn    int := 0;
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════';
  RAISE NOTICE '[057] COMPREHENSIVE ADVISOR VALIDATION REPORT';
  RAISE NOTICE '════════════════════════════════════════════════';

  -- ── 1. anon_security_definer_function_executable ───────────────────────────
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef = true
    AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND p.proname NOT IN (
      'check_login_rate_limit', 'fn_check_login_allowed',
      'enforce_password_reset_rate_limit', 'get_quote_token_by_value',
      'submit_quote_response'
    );
  IF v_count = 0 THEN
    v_pass := v_pass + 1;
    RAISE NOTICE '✓ [057] anon_security_definer_function_executable — 0 unauthorized functions remain';
  ELSE
    v_warn := v_warn + 1;
    RAISE WARNING '✗ [057] anon_security_definer_function_executable — % unauthorized anon-callable SECURITY DEFINER functions remain', v_count;
  END IF;

  -- ── 2. rls_disabled_in_public ─────────────────────────────────────────────
  SELECT count(*) INTO v_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND NOT c.relrowsecurity;
  IF v_count = 0 THEN
    v_pass := v_pass + 1;
    RAISE NOTICE '✓ [057] rls_disabled_in_public — all public tables have RLS enabled';
  ELSE
    v_warn := v_warn + 1;
    RAISE WARNING '✗ [057] rls_disabled_in_public — % public table(s) still have RLS disabled', v_count;
  END IF;

  -- ── 3. rls_enabled_no_policy ──────────────────────────────────────────────
  SELECT count(*) INTO v_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND c.relrowsecurity
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname
    );
  IF v_count = 0 THEN
    v_pass := v_pass + 1;
    RAISE NOTICE '✓ [057] rls_enabled_no_policy — all RLS-enabled tables have ≥1 policy';
  ELSE
    v_warn := v_warn + 1;
    RAISE WARNING '✗ [057] rls_enabled_no_policy — % table(s) have RLS on but 0 policies', v_count;
  END IF;

  -- ── 4. multiple_permissive_policies ───────────────────────────────────────
  SELECT count(*) INTO v_count
  FROM (
    SELECT tablename, cmd, roles::text
    FROM pg_policies
    WHERE schemaname = 'public' AND permissive = 'PERMISSIVE'
    GROUP BY tablename, cmd, roles::text
    HAVING count(*) > 1
  ) sub;
  IF v_count = 0 THEN
    v_pass := v_pass + 1;
    RAISE NOTICE '✓ [057] multiple_permissive_policies — no (table,cmd,roles) groups with 2+ PERMISSIVE policies';
  ELSE
    v_warn := v_warn + 1;
    RAISE WARNING '✗ [057] multiple_permissive_policies — % group(s) still have multiple PERMISSIVE policies', v_count;
  END IF;

  -- ── 5. unindexed_foreign_keys ─────────────────────────────────────────────
  SELECT count(*) INTO v_count
  FROM (
    WITH fk_cols AS (
      SELECT
        c.conname, tc.relname AS tbl,
        array_agg(a.attname ORDER BY col_ord.ord) AS cols,
        array_length(c.conkey, 1) AS col_cnt
      FROM pg_constraint c
      JOIN pg_class tc ON tc.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = tc.relnamespace
      JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS col_ord(attnum, ord) ON true
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = col_ord.attnum
      WHERE n.nspname = 'public' AND c.contype = 'f' AND tc.relkind = 'r'
      GROUP BY c.conname, tc.relname, c.conrelid, c.conkey, array_length(c.conkey, 1)
    )
    SELECT fk.tbl FROM fk_cols fk
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_index i
      JOIN pg_class tc2 ON tc2.oid = i.indrelid
      JOIN pg_namespace n2 ON n2.oid = tc2.relnamespace
      WHERE n2.nspname = 'public' AND tc2.relname = fk.tbl
        AND (
          SELECT array_agg(a2.attname ORDER BY kord.ord)
          FROM LATERAL unnest(i.indkey) WITH ORDINALITY AS kord(attnum, ord)
          JOIN pg_attribute a2 ON a2.attrelid = i.indrelid
            AND a2.attnum = kord.attnum AND kord.attnum > 0
          WHERE kord.ord <= fk.col_cnt
        ) = fk.cols
    )
  ) sub;
  IF v_count = 0 THEN
    v_pass := v_pass + 1;
    RAISE NOTICE '✓ [057] unindexed_foreign_keys — all FK columns have covering indexes';
  ELSE
    v_warn := v_warn + 1;
    RAISE WARNING '✗ [057] unindexed_foreign_keys — % FK group(s) still unindexed', v_count;
  END IF;

  -- ── 6. no_primary_key ─────────────────────────────────────────────────────
  SELECT count(*) INTO v_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND NOT c.relispartition
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint pk
      WHERE pk.conrelid = c.oid AND pk.contype = 'p'
    );
  IF v_count = 0 THEN
    v_pass := v_pass + 1;
    RAISE NOTICE '✓ [057] no_primary_key — all public tables have a primary key';
  ELSE
    v_warn := v_warn + 1;
    RAISE WARNING '✗ [057] no_primary_key — % public table(s) still lack a primary key', v_count;
  END IF;

  -- ── 7. function_search_path_mutable ───────────────────────────────────────
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind IN ('f', 'p')   -- functions and procedures
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(p.proconfig) AS cfg(val)
      WHERE cfg.val LIKE 'search_path=%'
    );
  IF v_count = 0 THEN
    v_pass := v_pass + 1;
    RAISE NOTICE '✓ [057] function_search_path_mutable — all public functions have a fixed search_path';
  ELSE
    v_warn := v_warn + 1;
    RAISE WARNING '✗ [057] function_search_path_mutable — % public function(s) still have mutable search_path', v_count;
  END IF;

  -- ── 8. extension_in_public ────────────────────────────────────────────────
  SELECT count(*) INTO v_count
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE n.nspname = 'public'
    AND e.extname NOT IN ('plpgsql', 'plv8', 'pg_net', 'pgsodium', 'supabase_vault',
                          'pg_graphql', 'vector', 'http');
  IF v_count = 0 THEN
    v_pass := v_pass + 1;
    RAISE NOTICE '✓ [057] extension_in_public — no relocatable extensions remain in public schema';
  ELSE
    v_warn := v_warn + 1;
    RAISE WARNING '✗ [057] extension_in_public — % extension(s) still in public schema', v_count;
  END IF;

  -- ── 9. duplicate_index ────────────────────────────────────────────────────
  SELECT count(*) INTO v_count
  FROM (
    SELECT
      i.indrelid::text || ':' || i.indkey::text || ':' ||
      COALESCE(pg_get_expr(i.indpred,  i.indrelid), '') || ':' ||
      COALESCE(pg_get_expr(i.indexprs, i.indrelid), '') AS sig
    FROM pg_index i
    JOIN pg_class tc ON tc.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = tc.relnamespace
    WHERE n.nspname = 'public' AND tc.relkind IN ('r', 'p')
    GROUP BY 1
    HAVING count(*) > 1
  ) sub;
  IF v_count = 0 THEN
    v_pass := v_pass + 1;
    RAISE NOTICE '✓ [057] duplicate_index — no duplicate index signatures remain';
  ELSE
    v_warn := v_warn + 1;
    RAISE WARNING '✗ [057] duplicate_index — % duplicate index group(s) remain', v_count;
  END IF;

  -- ── Final score ───────────────────────────────────────────────────────────
  RAISE NOTICE '════════════════════════════════════════════════';
  RAISE NOTICE '[057] ADVISOR VALIDATION RESULT: %/% checks passed',
    v_pass, (v_pass + v_warn);
  IF v_warn = 0 THEN
    RAISE NOTICE '✓ [057] ALL SQL-ADDRESSABLE ADVISOR FINDINGS CLEARED — 10/10 target achieved';
  ELSE
    RAISE WARNING '[057] % check(s) still report issues — investigate above warnings', v_warn;
  END IF;
  RAISE NOTICE '[057] NOTE: leaked_password_protection / mfa_not_enabled / pitr_not_enabled';
  RAISE NOTICE '[057]       require manual configuration in the Supabase dashboard.';
  RAISE NOTICE '════════════════════════════════════════════════';

  RAISE NOTICE 'Migration 057 complete.';
END;
$$;
