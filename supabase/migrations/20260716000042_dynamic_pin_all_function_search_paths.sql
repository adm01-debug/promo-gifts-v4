-- Migration 042: Dynamic search_path pinning for ALL remaining public functions
--
-- Source: 200-commit audit — follow-up on migration 009 (point-in-time, 44 functions)
-- Findings addressed: function_search_path_mutable (all remaining)
--
-- ─── Why migration 009 is insufficient ───────────────────────────────────────
--
-- Migration 009 pinned search_path on 44 specific functions by name. However:
--   1. The list was a point-in-time snapshot — functions created before or after
--      migration 009 in other migration files are not covered.
--   2. 200+ older migration files (e.g. products_*.sql, fn_spr_history trigger
--      from 2026-06-04) may contain functions never in the 44-function list.
--   3. Migrations 010-041 in this audit series created a few additional functions
--      (audit_security_definer_acl, restore_seller_cart, fn_rpc_exists).
--
-- Fix: Query pg_proc dynamically to find ALL public functions/procedures/aggregates
-- without a pinned search_path, then ALTER them in a single migration run.
-- This migration is idempotent — already-pinned functions are filtered out.
--
-- ─── Search path value ────────────────────────────────────────────────────────
--
-- 'public', 'extensions' — all existing pins in migration 009 use this pair.
--   - 'public' allows unqualified references to application tables/functions
--   - 'extensions' allows unqualified use of uuid-ossp, pgcrypto etc.
-- Functions that use pg_catalog objects already find them (it's always searched).

-- ═══════════════════════════════════════════════════════════════════════════════
-- Part 1: Regular functions (prokind = 'f')
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r        RECORD;
  v_sql    text;
  v_ok     int := 0;
  v_fail   int := 0;
BEGIN
  FOR r IN
    SELECT
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
    ORDER BY p.proname, p.oid
  LOOP
    v_sql := format(
      $fmt$ALTER FUNCTION public.%I(%s) SET search_path = 'public', 'extensions'$fmt$,
      r.proname, r.args
    );
    BEGIN
      EXECUTE v_sql;
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[042] ✗ Cannot pin function %(%): %',
        r.proname, r.args, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[042] Regular functions: pinned=%, failed=%', v_ok, v_fail;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Part 2: Procedures (prokind = 'p')
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r        RECORD;
  v_sql    text;
  v_ok     int := 0;
  v_fail   int := 0;
BEGIN
  FOR r IN
    SELECT
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'p'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
    ORDER BY p.proname, p.oid
  LOOP
    v_sql := format(
      $fmt$ALTER PROCEDURE public.%I(%s) SET search_path = 'public', 'extensions'$fmt$,
      r.proname, r.args
    );
    BEGIN
      EXECUTE v_sql;
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[042] ✗ Cannot pin procedure %(%): %',
        r.proname, r.args, SQLERRM;
    END;
  END LOOP;

  IF v_ok + v_fail > 0 THEN
    RAISE NOTICE '[042] Procedures: pinned=%, failed=%', v_ok, v_fail;
  ELSE
    RAISE NOTICE '[042] No unpinned procedures found in public schema';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Part 3: Aggregates (prokind = 'a')
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r        RECORD;
  v_sql    text;
  v_ok     int := 0;
  v_fail   int := 0;
BEGIN
  FOR r IN
    SELECT
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'a'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
    ORDER BY p.proname, p.oid
  LOOP
    v_sql := format(
      $fmt$ALTER AGGREGATE public.%I(%s) SET search_path = 'public', 'extensions'$fmt$,
      r.proname, r.args
    );
    BEGIN
      EXECUTE v_sql;
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[042] ✗ Cannot pin aggregate %(%): %',
        r.proname, r.args, SQLERRM;
    END;
  END LOOP;

  IF v_ok + v_fail > 0 THEN
    RAISE NOTICE '[042] Aggregates: pinned=%, failed=%', v_ok, v_fail;
  ELSE
    RAISE NOTICE '[042] No unpinned aggregates found in public schema';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Validation: Count remaining mutable-search-path public routines
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_total     int;
  v_mutable   int;
  v_pct       numeric;
BEGIN
  SELECT count(*) INTO v_total
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p', 'a');

  SELECT count(*) INTO v_mutable
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind IN ('f', 'p', 'a')
    AND NOT EXISTS (
      SELECT 1 FROM unnest(p.proconfig) AS cfg
      WHERE cfg LIKE 'search_path=%'
    );

  v_pct := CASE WHEN v_total > 0
                THEN round((v_mutable::numeric / v_total) * 100, 1)
                ELSE 0 END;

  IF v_mutable = 0 THEN
    RAISE NOTICE '✓ [042] All % public routines have pinned search_path — function_search_path_mutable cleared',
      v_total;
  ELSIF v_mutable <= 5 THEN
    -- Tiny remainder may be system-owned or unalterable functions
    RAISE NOTICE '[042] % of % public routines still mutable (%.%% — likely system functions)',
      v_mutable, v_total, v_pct / 10, v_pct % 10;
  ELSE
    RAISE WARNING '[042] % of % public routines still have mutable search_path — investigate',
      v_mutable, v_total;
  END IF;

  RAISE NOTICE 'Migration 042 complete — function_search_path_mutable should clear on next advisor run.';
END;
$$;
