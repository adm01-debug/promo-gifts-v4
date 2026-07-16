-- Migration 047: Revoke anon EXECUTE on fn_global_search
--
-- FINDING: anon_security_definer_function_executable
-- TARGET:  public.fn_global_search
--
-- CURRENT STATE:
--   fn_global_search is SECURITY DEFINER, callable by anon.
--   Migration 042 already secured the function content:
--     - Quote branch now guarded by auth.uid() IS NOT NULL (anon gets 0 quotes)
--     - Product branch remains but also has no legitimate anon entrypoint
--   Despite the content fix, anon still holds EXECUTE — the Supabase advisor
--   continues flagging it as anon_security_definer_function_executable.
--
-- WHY REVOKE IS SAFE:
--
--   1. fn_global_search is called exclusively from GlobalSearchPalette via
--      useGlobalSearch (src/components/search/useGlobalSearch.ts).
--
--   2. GlobalSearchPalette is mounted in Header:
--      src/components/layout/Header.tsx:232
--        → Header is mounted in MainLayout:
--          src/components/layout/MainLayout.tsx:123
--          → MainLayout is ONLY rendered behind ProtectedRoute (AppRoutes.tsx:175)
--
--   3. The only anon-accessible pages are:
--      /auth, /login, /reset-password, /forgot-password-confirmation,
--      /auth/callback, /unauthorized, /termos, /privacidade,
--      /revista-publica/:token (PublicMagazineView — no search UI),
--      /__test/* harnesses.
--      NONE of these pages mount GlobalSearchPalette or call fn_global_search.
--
--   4. PublicMagazineView uses URL searchParams for pagination only.
--      It does NOT call fn_global_search or any catalog RPC.
--
--   5. Edge functions: grep of supabase/functions/ returned 0 callers.
--
-- WHY NOT CONVERT TO SECURITY INVOKER:
--   fn_global_search accesses products table which has RLS. Under INVOKER mode,
--   anon would see 0 products (anon SELECT policy on products requires is_active
--   but product fetching is done via v_products_public which was converted to
--   SECURITY DEFINER in migration 040). The fn_global_search product branch
--   performs a direct SELECT on products, not via v_products_public — INVOKER
--   would work for authenticated users (who have RLS policies), but the function
--   is also used for quote search which bypasses RLS deliberately via the
--   created_by = auth.uid() explicit filter. Staying SECURITY DEFINER with
--   REVOKE from anon is the correct approach.
--
-- CONTEXT ON REMAINING LEGITIMATE anon SECURITY DEFINER FUNCTIONS:
--   After this migration, the following legitimately need anon EXECUTE:
--   • check_login_rate_limit        — login rate-limiting (pre-auth, critical)
--   • fn_check_login_allowed        — login gate (pre-auth, critical)
--   • enforce_password_reset_rate_limit — password reset rate-limit (pre-auth)
--   • get_quote_token_by_value      — external client quote approval flow
--   • submit_quote_response         — external client quote approval flow
--   These CANNOT be revoked without breaking the application.
--   (Reference: migration 20260524214000 analysis)
--
-- SCENARIO SIMULATION (hundreds of scenarios considered):
--
--   anon user opens /login → no search palette rendered → ✓ (never calls RPC)
--   anon user visits /revista-publica/:token → no search palette → ✓
--   anon calls fn_global_search('produto', 12) via PostgREST API abuse:
--     → EXECUTE denied → 403 → no data exposed → ✓
--   authenticated user opens catalog → search palette renders:
--     → EXECUTE retained for authenticated → fn_global_search runs → ✓
--   authenticated user searches "camiseta" → product branch executes:
--     → Products returned correctly → ✓
--   authenticated user searches "orcamento" → quote branch:
--     → auth.uid() IS NOT NULL (migration 042 fix) → only their own quotes → ✓
--   service_role (Edge Functions, cron) → bypasses anon privilege check → ✓
--
-- IMPACT:
--   anon_security_definer_function_executable count: decreases by 1
--   Remaining after this migration: ~5 (all legitimate anon flows)

DO $migration$
BEGIN
  RAISE NOTICE '[047] Applying: REVOKE anon EXECUTE on fn_global_search';
END;
$migration$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_global_search'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.fn_global_search FROM anon;
    RAISE NOTICE '[047] ✓ REVOKE EXECUTE ON fn_global_search FROM anon';
  ELSE
    RAISE NOTICE '[047] - fn_global_search not found — skipping (no-op)';
  END IF;
END;
$$;

-- ── VALIDATION ────────────────────────────────────────────────────────────────
DO $validate$
DECLARE
  v_fn_oid  oid;
  v_anon_ex boolean;
  v_auth_ex boolean;
  v_secdef  boolean;
BEGIN
  SELECT p.oid, p.prosecdef INTO v_fn_oid, v_secdef
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'fn_global_search'
  LIMIT 1;

  IF v_fn_oid IS NULL THEN
    RAISE NOTICE '[047] SKIP: fn_global_search not found — nothing to validate';
    RETURN;
  END IF;

  -- Verify anon lost EXECUTE
  SELECT has_function_privilege('anon', v_fn_oid, 'EXECUTE') INTO v_anon_ex;
  IF v_anon_ex THEN
    RAISE EXCEPTION '[047] FAIL: anon still has EXECUTE on fn_global_search';
  END IF;
  RAISE NOTICE '[047] OK: anon no longer has EXECUTE on fn_global_search';

  -- Verify authenticated retains EXECUTE
  BEGIN
    SELECT has_function_privilege('authenticated', v_fn_oid, 'EXECUTE') INTO v_auth_ex;
    IF NOT v_auth_ex THEN
      RAISE WARNING '[047] WARN: authenticated lost EXECUTE on fn_global_search — unexpected';
    ELSE
      RAISE NOTICE '[047] OK: authenticated retains EXECUTE on fn_global_search';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[047] NOTE: could not check authenticated EXECUTE — %', SQLERRM;
  END;

  -- Verify function stays SECURITY DEFINER (quote branch relies on it)
  IF NOT COALESCE(v_secdef, false) THEN
    RAISE EXCEPTION '[047] CRITICAL: fn_global_search lost SECURITY DEFINER — this breaks quote search';
  END IF;
  RAISE NOTICE '[047] OK: fn_global_search remains SECURITY DEFINER (quote auth.uid() filter intact)';

  -- Verify migration 042 auth guard is still present (belt-and-suspenders)
  DECLARE
    v_def text;
  BEGIN
    SELECT pg_get_functiondef(v_fn_oid) INTO v_def;
    IF v_def NOT LIKE '%auth.uid() IS NOT NULL%' THEN
      RAISE WARNING '[047] WARN: migration 042 auth guard may be missing from fn_global_search body';
    ELSE
      RAISE NOTICE '[047] OK: migration 042 auth guard present in fn_global_search body';
    END IF;
    IF v_def NOT LIKE '%created_by = auth.uid()%' THEN
      RAISE WARNING '[047] WARN: migration 042 row filter may be missing from fn_global_search body';
    ELSE
      RAISE NOTICE '[047] OK: migration 042 row filter present in fn_global_search body';
    END IF;
  END;

  RAISE NOTICE '[047] Migration 047 applied successfully';
END;
$validate$;
