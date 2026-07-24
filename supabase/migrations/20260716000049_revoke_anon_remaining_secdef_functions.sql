-- Migration 049: Revoke anon EXECUTE on 3 remaining SECURITY DEFINER functions
--
-- Source: 200-commit audit — Supabase security advisor finding
-- Findings addressed: anon_security_definer_function_executable (×3)
-- TARGETS:
--   1. public.get_profile_and_roles(uuid)
--   2. public.get_favorite_list_counts(uuid)
--   3. public.get_public_schema_signatures()
--
-- ─── Architecture context ─────────────────────────────────────────────────────
--
-- This is a B2B wholesale platform. All catalog and user-data pages sit behind
-- <ProtectedRoute /> (src/routes/AppRoutes.tsx:175). The only anon-accessible
-- routes are: /auth, /login, /reset-password, /forgot-password-confirmation,
-- /auth/callback, /unauthorized, /termos, /privacidade,
-- /revista-publica/:token, and /__test/* harnesses.
--
-- ─── Evidence per function ────────────────────────────────────────────────────
--
-- 1. public.get_profile_and_roles(uuid)
--    Called by: src/hooks/auth/useProfileRoles.ts (called only after auth session
--    establishes userId), src/services/authService.ts:71 (called with authenticated
--    userId).
--    Guard evidence: useFavoriteLists checks `if (!user) return []` and
--    `enabled: !!user` before any rpc call. AuthService is called post-login.
--    Anon has no userId → calling this with NULL/fake UUID returns empty/null.
--    Safe to revoke: anon will never legitimately call this.
--
-- 2. public.get_favorite_list_counts(uuid)
--    Called by: src/hooks/favorites/useFavoriteLists.ts:99
--    Guard evidence (lines 69-115): `const { user } = useAuth()`, checks
--    `if (!user) return []` at line 76, `enabled: !!user` at line 115.
--    The query is disabled when user is absent — anon never triggers the RPC.
--    Safe to revoke: auth guard in caller prevents any anon execution path.
--
-- 3. public.get_public_schema_signatures()
--    Called by: NO call sites in src/ (only referenced in types.ts type
--    definition). This is an admin/audit introspection function — it returns
--    the list of all public schema function signatures.
--    Safe to revoke: zero call sites; anon accessing this would expose internal
--    schema metadata (information disclosure).
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
-- REVOKE on a privilege that doesn't exist is a no-op in PostgreSQL.
-- Exception handling ensures one failed REVOKE does not abort the migration.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Revoke anon EXECUTE from the 3 remaining SECURITY DEFINER functions
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_ok   int := 0;
  v_fail int := 0;
BEGIN
  -- ── 1. get_profile_and_roles(uuid) ────────────────────────────────────────
  BEGIN
    REVOKE EXECUTE ON FUNCTION public.get_profile_and_roles(uuid) FROM anon;
    v_ok := v_ok + 1;
    RAISE NOTICE '✓ [049] REVOKE EXECUTE ON get_profile_and_roles(uuid) FROM anon';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE '- [049] get_profile_and_roles(uuid) not found — skipping';
    WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[049] ✗ Could not revoke get_profile_and_roles(uuid): %', SQLERRM;
  END;

  -- ── 2. get_favorite_list_counts(uuid) ─────────────────────────────────────
  BEGIN
    REVOKE EXECUTE ON FUNCTION public.get_favorite_list_counts(uuid) FROM anon;
    v_ok := v_ok + 1;
    RAISE NOTICE '✓ [049] REVOKE EXECUTE ON get_favorite_list_counts(uuid) FROM anon';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE '- [049] get_favorite_list_counts(uuid) not found — skipping';
    WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[049] ✗ Could not revoke get_favorite_list_counts(uuid): %', SQLERRM;
  END;

  -- ── 3. get_public_schema_signatures() ─────────────────────────────────────
  BEGIN
    REVOKE EXECUTE ON FUNCTION public.get_public_schema_signatures() FROM anon;
    v_ok := v_ok + 1;
    RAISE NOTICE '✓ [049] REVOKE EXECUTE ON get_public_schema_signatures() FROM anon';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE '- [049] get_public_schema_signatures() not found — skipping';
    WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING '[049] ✗ Could not revoke get_public_schema_signatures(): %', SQLERRM;
  END;

  RAISE NOTICE '[049] Summary: revoked=%, failed=%', v_ok, v_fail;

  IF v_fail > 0 THEN
    RAISE WARNING '[049] % revocation(s) failed — check warnings above', v_fail;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Validation: Confirm anon can no longer EXECUTE these functions
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_remaining int;
  r           RECORD;
  v_targets   text[] := ARRAY[
    'get_profile_and_roles',
    'get_favorite_list_counts',
    'get_public_schema_signatures'
  ];
BEGIN
  -- Count how many of the target functions still have anon EXECUTE
  SELECT count(*) INTO v_remaining
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = ANY(v_targets)
    AND p.prosecdef = true  -- SECURITY DEFINER
    AND has_function_privilege('anon', p.oid, 'EXECUTE');

  IF v_remaining = 0 THEN
    RAISE NOTICE '✓ [049] All 3 target functions: anon EXECUTE revoked — anon_security_definer_function_executable cleared for these functions';
  ELSE
    FOR r IN
      SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = ANY(v_targets)
        AND p.prosecdef = true
        AND has_function_privilege('anon', p.oid, 'EXECUTE')
    LOOP
      RAISE WARNING '[049] Still callable by anon: %(%)' , r.proname, r.args;
    END LOOP;
  END IF;

  -- Report remaining anon-callable SECURITY DEFINER functions overall
  SELECT count(*) INTO v_remaining
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef = true
    AND has_function_privilege('anon', p.oid, 'EXECUTE');

  RAISE NOTICE '[049] Total remaining public SECURITY DEFINER functions callable by anon: %', v_remaining;

  IF v_remaining <= 5 THEN
    RAISE NOTICE '✓ [049] ≤5 remaining — only legitimate auth-flow functions expected (check_login_rate_limit, fn_check_login_allowed, enforce_password_reset_rate_limit, get_quote_token_by_value, submit_quote_response)';
  ELSE
    RAISE WARNING '[049] % public SECURITY DEFINER functions still callable by anon — investigate', v_remaining;
  END IF;

  RAISE NOTICE 'Migration 049 complete.';
END;
$$;
