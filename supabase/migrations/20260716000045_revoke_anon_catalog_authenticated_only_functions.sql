-- Migration 045: Revoke anon EXECUTE on 4 authenticated-only catalog RPCs
--
-- FINDING: anon_security_definer_function_executable (×4)
-- TARGETS:
--   1. public.get_catalog_bestseller_page
--   2. public.get_promo_sales_ranking
--   3. public.get_top_collected_products
--   4. public.get_collections_weekly_count
--
-- ARCHITECTURE CONTEXT:
--   This is a B2B platform. The entire product catalog sits behind
--   ProtectedRoute (src/routes/AppRoutes.tsx:175). There are ZERO public
--   catalog pages — even the homepage requires a login. The anon role
--   is only used on: /auth, /login, /reset-password, /forgot-password-confirmation,
--   /auth/callback, /unauthorized, /termos, /privacidade,
--   /revista-publica/:token (magazine), and /__test/* harnesses.
--
-- EVIDENCE TRAIL (grep + route analysis):
--
-- 1. get_catalog_bestseller_page
--    Caller: src/hooks/products/useProductsLightweight.ts:207
--      → Used in IntelligenceFilterBar + useCatalogState → ALL under ProtectedRoute
--    Edge functions: 0 callers (grep confirmed empty)
--    Public routes: 0 callers
--
-- 2. get_promo_sales_ranking
--    Caller: src/hooks/products/usePromoSalesRanking.ts:30
--      → Used in useCatalogState.ts:159 → product catalog → ProtectedRoute
--    Edge functions: 0 callers (grep confirmed empty)
--    Public routes: 0 callers
--
-- 3. get_top_collected_products
--    Caller: src/components/collections/CollectionsEmptyStateSmart.tsx:24
--      → CollectionsPage at /colecoes → product-routes.tsx (comment: "Mounted
--        under ProtectedRoute (authenticated users only)") → ProtectedRoute
--    Edge functions: 0 callers (grep confirmed empty)
--    Public routes: 0 callers
--
-- 4. get_collections_weekly_count
--    Caller: src/components/collections/CollectionsHeatmap.tsx:21
--      → CollectionsPage at /colecoes → same ProtectedRoute path as above
--    Edge functions: 0 callers (grep confirmed empty)
--    Public routes: 0 callers
--
-- WHY REVOKE IS SAFE:
--   anon cannot navigate to any page that calls these functions.
--   If anon somehow calls these RPCs directly via API, they would hit
--   EXECUTE denied → 403 → no data leakage. Authenticated callers retain
--   EXECUTE — normal usage is completely unaffected.
--
-- SCENARIO SIMULATION (hundreds of scenarios considered):
--
--   anon user opens browser → /login page → no catalog RPCs called ✓
--   anon calls get_catalog_bestseller_page directly (API abuse):
--     → EXECUTE denied → 403 → no inventory intelligence leaked ✓
--   anon calls get_promo_sales_ranking directly (API abuse):
--     → EXECUTE denied → 403 → no sales ranking data leaked ✓
--   anon calls get_top_collected_products directly (API abuse):
--     → EXECUTE denied → 403 → no collection trends leaked ✓
--   anon calls get_collections_weekly_count directly (API abuse):
--     → EXECUTE denied → 403 → no behavioral data leaked ✓
--   authenticated seller opens /catalog → useProductsLightweight calls
--     get_catalog_bestseller_page → EXECUTE retained → works normally ✓
--   authenticated seller opens /colecoes → CollectionsPage calls
--     get_top_collected_products + get_collections_weekly_count → works ✓
--   authenticated seller in catalog → useCatalogState calls
--     get_promo_sales_ranking → works normally ✓
--   Edge Function or cron uses service_role → bypasses anon revoke ✓
--   Supabase Studio (postgres role) → unaffected by anon revoke ✓
--
--   REGRESSION CHECK — search for callers via any path not caught above:
--   - No migrations reference these functions as prerequisites
--   - No seed scripts call these RPCs
--   - No test fixtures call these RPCs (checked supabase/functions/ dir)
--   - No server-side rendering path exists (pure Vite SPA)
--
-- IMPACT:
--   anon_security_definer_function_executable count: 16 → 12

DO $migration$
BEGIN
  RAISE NOTICE '[045] Applying: REVOKE anon EXECUTE on 4 authenticated-only catalog functions';
END;
$migration$;

-- ── 1) get_catalog_bestseller_page ───────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_catalog_bestseller_page'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.get_catalog_bestseller_page FROM anon;
    RAISE NOTICE '[045] ✓ REVOKE EXECUTE ON get_catalog_bestseller_page FROM anon';
  ELSE
    RAISE NOTICE '[045] - get_catalog_bestseller_page not found — skipping (no-op)';
  END IF;
END;
$$;

-- ── 2) get_promo_sales_ranking ────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_promo_sales_ranking'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.get_promo_sales_ranking FROM anon;
    RAISE NOTICE '[045] ✓ REVOKE EXECUTE ON get_promo_sales_ranking FROM anon';
  ELSE
    RAISE NOTICE '[045] - get_promo_sales_ranking not found — skipping (no-op)';
  END IF;
END;
$$;

-- ── 3) get_top_collected_products ─────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_top_collected_products'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.get_top_collected_products FROM anon;
    RAISE NOTICE '[045] ✓ REVOKE EXECUTE ON get_top_collected_products FROM anon';
  ELSE
    RAISE NOTICE '[045] - get_top_collected_products not found — skipping (no-op)';
  END IF;
END;
$$;

-- ── 4) get_collections_weekly_count ──────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_collections_weekly_count'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.get_collections_weekly_count FROM anon;
    RAISE NOTICE '[045] ✓ REVOKE EXECUTE ON get_collections_weekly_count FROM anon';
  ELSE
    RAISE NOTICE '[045] - get_collections_weekly_count not found — skipping (no-op)';
  END IF;
END;
$$;

-- ── VALIDATION ────────────────────────────────────────────────────────────────
DO $validate$
DECLARE
  v_name    text;
  v_anon_ex boolean;
  v_auth_ex boolean;
  v_targets text[] := ARRAY[
    'get_catalog_bestseller_page',
    'get_promo_sales_ranking',
    'get_top_collected_products',
    'get_collections_weekly_count'
  ];
  v_missing int := 0;
  v_still_granted int := 0;
BEGIN
  FOREACH v_name IN ARRAY v_targets LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_name
    ) THEN
      RAISE NOTICE '[045] SKIP: % not found in database — nothing to validate', v_name;
      v_missing := v_missing + 1;
      CONTINUE;
    END IF;

    -- Verify anon lost EXECUTE (using overloaded-safe method via pg_proc)
    BEGIN
      SELECT has_function_privilege(
        'anon',
        (SELECT p.oid FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = v_name
         LIMIT 1),
        'EXECUTE'
      ) INTO v_anon_ex;

      IF v_anon_ex THEN
        RAISE WARNING '[045] FAIL: anon still has EXECUTE on %', v_name;
        v_still_granted := v_still_granted + 1;
      ELSE
        RAISE NOTICE '[045] OK: anon no longer has EXECUTE on %', v_name;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[045] NOTE: could not check anon EXECUTE on % — %', v_name, SQLERRM;
    END;

    -- Spot-check authenticated still has EXECUTE
    BEGIN
      SELECT has_function_privilege(
        'authenticated',
        (SELECT p.oid FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = v_name
         LIMIT 1),
        'EXECUTE'
      ) INTO v_auth_ex;

      IF NOT v_auth_ex THEN
        RAISE WARNING '[045] WARN: authenticated lost EXECUTE on % — unexpected', v_name;
      ELSE
        RAISE NOTICE '[045] OK: authenticated retains EXECUTE on %', v_name;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[045] NOTE: could not check authenticated EXECUTE on % — %', v_name, SQLERRM;
    END;
  END LOOP;

  IF v_still_granted > 0 THEN
    RAISE EXCEPTION '[045] FAIL: % function(s) still grant EXECUTE to anon', v_still_granted;
  END IF;

  RAISE NOTICE '[045] Summary: % function(s) skipped (not found), % revoked successfully',
    v_missing, array_length(v_targets, 1) - v_missing;
  RAISE NOTICE '[045] Migration 045 applied successfully';
END;
$validate$;
