-- Migration 059: Fix REVOKE FROM PUBLIC on catalog SECURITY DEFINER functions
--
-- Source: 200-commit audit — post-migration verification finding
-- Findings addressed: anon_security_definer_function_executable (5 remaining)
--
-- ─── Root Cause ──────────────────────────────────────────────────────────────
--
-- Migrations 045/046 used:
--   REVOKE EXECUTE ON FUNCTION public.fn_super_filtro(...) FROM anon
--
-- This has NO EFFECT when the original grant was TO PUBLIC (not TO anon).
-- In PostgreSQL, REVOKE FROM <specific_role> only removes an explicit grant
-- to that role. If the privilege came via PUBLIC membership, the role retains
-- access until the PUBLIC grant is removed.
--
-- Verification:
--   SELECT proacl FROM pg_proc WHERE proname = 'fn_super_filtro';
--   → {=X/postgres, postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres}
--   The "=X/postgres" is a PUBLIC grant. REVOKE FROM anon left it untouched.
--
-- ─── Fix ─────────────────────────────────────────────────────────────────────
--
-- For each affected function:
--   1. REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC
--      → Removes the "=X/postgres" entry from proacl
--   2. GRANT EXECUTE ON FUNCTION ... TO authenticated
--      → Preserves/ensures authenticated access (was already explicit)
--   3. GRANT EXECUTE ON FUNCTION ... TO service_role
--      → Preserves/ensures service_role access (was already explicit)
--
-- Result proacl:
--   {postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres}
--   → anon no longer has EXECUTE (no PUBLIC grant, no explicit grant)
--   → authenticated and service_role retain full EXECUTE
--
-- ─── Functions affected ───────────────────────────────────────────────────────
--
-- 1. fn_super_filtro         — B2B catalog super-filter (auth required)
-- 2. fn_super_filtro_facets  — B2B catalog facets (auth required)
-- 3. fn_super_filtro_price_range — B2B price range (auth required)
-- 4. get_catalog_bestseller_page — B2B bestseller ranking (auth required)
-- 5. get_promo_sales_ranking     — B2B promo ranking (auth required)
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
-- REVOKE FROM PUBLIC when no PUBLIC grant exists → no-op (PostgreSQL silently ignores)
-- GRANT TO authenticated/service_role when grant already exists → no-op
-- Re-running is safe.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 1: Revoke PUBLIC grant, preserve authenticated + service_role
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r       RECORD;
  v_name  text;
  v_ok    int := 0;
  v_fail  int := 0;
  v_funcs text[] := ARRAY[
    'fn_super_filtro',
    'fn_super_filtro_facets',
    'fn_super_filtro_price_range',
    'get_catalog_bestseller_page',
    'get_promo_sales_ranking'
  ];
BEGIN
  FOREACH v_name IN ARRAY v_funcs
  LOOP
    FOR r IN
      SELECT p.oid,
             p.proname,
             pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = v_name
      ORDER BY p.oid
    LOOP
      BEGIN
        -- Step 1: Remove PUBLIC grant (the root cause of anon access)
        EXECUTE format(
          'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC',
          r.proname, r.args
        );

        -- Step 2: Ensure authenticated retains explicit EXECUTE
        EXECUTE format(
          'GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',
          r.proname, r.args
        );

        -- Step 3: Ensure service_role retains explicit EXECUTE
        EXECUTE format(
          'GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',
          r.proname, r.args
        );

        v_ok := v_ok + 1;
        RAISE NOTICE '✓ [059] Revoked PUBLIC; re-granted authenticated+service_role: %(%)',
          r.proname, r.args;

      EXCEPTION WHEN OTHERS THEN
        v_fail := v_fail + 1;
        RAISE WARNING '[059] ✗ Failed for %(%): %', r.proname, r.args, SQLERRM;
      END;
    END LOOP;
  END LOOP;

  RAISE NOTICE '[059] Phase 1 complete: ok=%, fail=%', v_ok, v_fail;

  IF v_fail > 0 THEN
    RAISE WARNING '[059] % function(s) could not be fixed — check warnings above', v_fail;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2: Validate anon no longer has EXECUTE on these functions
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r              RECORD;
  v_anon_remain  int := 0;
  v_auth_ok      int := 0;
BEGIN
  -- Check anon no longer callable
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'fn_super_filtro', 'fn_super_filtro_facets', 'fn_super_filtro_price_range',
        'get_catalog_bestseller_page', 'get_promo_sales_ranking'
      )
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
    ORDER BY p.proname
  LOOP
    v_anon_remain := v_anon_remain + 1;
    RAISE WARNING '[059] ✗ Still anon-callable: %(%)', r.proname, r.args;
  END LOOP;

  IF v_anon_remain = 0 THEN
    RAISE NOTICE '✓ [059] All 5 catalog SECURITY DEFINER functions: anon EXECUTE revoked (PUBLIC grant removed)';
  ELSE
    RAISE WARNING '[059] % function(s) still anon-callable — PUBLIC grant may still exist', v_anon_remain;
  END IF;

  -- Check authenticated still callable (must not break)
  -- NOTE: use OID form — pg_get_function_identity_arguments returns "name type" which
  -- cannot be parsed as regprocedure; OID bypasses text parsing entirely.
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'fn_super_filtro', 'fn_super_filtro_facets', 'fn_super_filtro_price_range',
        'get_catalog_bestseller_page', 'get_promo_sales_ranking'
      )
    ORDER BY p.proname
  LOOP
    IF has_function_privilege('authenticated', r.oid, 'EXECUTE') THEN
      v_auth_ok := v_auth_ok + 1;
      RAISE NOTICE '✓ [059] authenticated can still call %(%)', r.proname, r.args;
    ELSE
      RAISE WARNING '[059] ✗ authenticated LOST EXECUTE on %(%)', r.proname, r.args;
    END IF;
  END LOOP;

  -- Final count check
  DECLARE
    v_total_anon_secdef int;
  BEGIN
    SELECT count(*) INTO v_total_anon_secdef
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

    IF v_total_anon_secdef = 0 THEN
      RAISE NOTICE '✓ [059] anon_security_definer_function_executable — 0 unauthorized SECURITY DEFINER functions callable by anon';
    ELSE
      RAISE WARNING '[059] % unauthorized anon-callable SECURITY DEFINER functions still remain', v_total_anon_secdef;
    END IF;
  END;

  RAISE NOTICE 'Migration 059 complete — anon_security_definer_function_executable should clear on next advisor run.';
END;
$$;
