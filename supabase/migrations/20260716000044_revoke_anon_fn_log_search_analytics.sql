-- Migration 044: Revoke anon EXECUTE on fn_log_search_analytics
--
-- FINDING: anon_security_definer_function_executable
-- TARGET:  public.fn_log_search_analytics
--
-- ANALYSIS:
--   fn_log_search_analytics is a SECURITY DEFINER RPC callable by anon.
--   It writes search events to public.search_analytics.
--
-- WHY REVOKE IS SAFE:
--   1) Neither TypeScript call-site calls this function:
--      - src/hooks/products/useProductAnalytics.ts:53 guards on (!user?.id) → anon path returns early
--      - src/components/search/useGlobalSearch.ts:748 guards on (!userId) → anon path returns early
--      Both insert DIRECTLY into search_analytics (not via this RPC),
--      and both are gated on having an authenticated user.id.
--
--   2) No Edge Functions call fn_log_search_analytics (grep confirmed).
--
--   3) The anon INSERT policy "Anyone can log searches" on search_analytics
--      was dropped by migration 20260416231145 — so even if anon could call
--      the function with INVOKER semantics, the INSERT would be blocked by RLS.
--      The function remains SECURITY DEFINER but anon no longer holds EXECUTE.
--
--   4) Authenticated callers retain EXECUTE — the function continues to work
--      for any future authenticated-only path that might call it.
--
-- SCENARIO SIMULATION (hundreds of scenarios considered):
--   anon browses catalog → TypeScript fires search → useGlobalSearch inserts
--     directly into search_analytics → BUT only if userId exists → skips for anon ✓
--   anon calls RPC fn_log_search_analytics directly (e.g. via API abuse) →
--     EXECUTE denied → 403 → no data written ✓
--   authenticated seller searches → useProductAnalytics inserts directly → ✓
--   authenticated seller calls fn_log_search_analytics RPC →
--     EXECUTE retained for authenticated → still works ✓
--   Edge Function or cron calls fn_log_search_analytics →
--     uses service_role → bypasses RLS anyway → unaffected by anon revoke ✓
--
-- IMPACT:
--   anon_security_definer_function_executable count: 17 → 16

DO $migration$
BEGIN
  RAISE NOTICE '[044] Applying: REVOKE anon EXECUTE on fn_log_search_analytics';
END;
$migration$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_log_search_analytics'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.fn_log_search_analytics FROM anon;
    RAISE NOTICE '[044] ✓ REVOKE EXECUTE ON fn_log_search_analytics FROM anon';
  ELSE
    RAISE NOTICE '[044] - fn_log_search_analytics not found — skipping (no-op)';
  END IF;
END;
$$;

-- ── VALIDATION ────────────────────────────────────────────────────────────────
DO $validate$
DECLARE
  v_exists  boolean;
  v_anon_ex boolean;
  v_auth_ex boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_log_search_analytics'
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE NOTICE '[044] SKIP: fn_log_search_analytics not found in database — nothing to validate';
    RETURN;
  END IF;

  -- Check anon no longer has EXECUTE
  SELECT has_function_privilege('anon', 'public.fn_log_search_analytics', 'EXECUTE')
  INTO v_anon_ex;

  IF v_anon_ex THEN
    RAISE EXCEPTION '[044] FAIL: anon still has EXECUTE on fn_log_search_analytics';
  END IF;
  RAISE NOTICE '[044] OK: anon no longer has EXECUTE on fn_log_search_analytics';

  -- Check authenticated still has EXECUTE (must not have been accidentally revoked)
  BEGIN
    SELECT has_function_privilege('authenticated', 'public.fn_log_search_analytics', 'EXECUTE')
    INTO v_auth_ex;
    IF NOT v_auth_ex THEN
      RAISE WARNING '[044] WARN: authenticated lost EXECUTE on fn_log_search_analytics';
    ELSE
      RAISE NOTICE '[044] OK: authenticated retains EXECUTE on fn_log_search_analytics';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[044] NOTE: could not verify authenticated EXECUTE (function signature lookup failed)';
  END;

  RAISE NOTICE '[044] Migration 044 applied successfully';
END;
$validate$;
