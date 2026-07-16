-- Migration 046: Revoke anon EXECUTE on 9 remaining catalog-only SECURITY DEFINER functions
--
-- FINDING: anon_security_definer_function_executable (×9)
-- TARGETS:
--   1. public.fn_super_filtro
--   2. public.fn_super_filtro_facets
--   3. public.fn_super_filtro_opcoes
--   4. public.fn_super_filtro_price_range
--   5. public.fn_super_filtro_product_ids
--   6. public.fn_get_all_leaf_categories
--   7. public.fn_get_color_swatches_batch
--   8. public.fn_get_product_customization_options
--   9. public.fn_get_customization_price
--
-- ─── ARCHITECTURE CONTEXT ────────────────────────────────────────────────────
--
-- This is a B2B wholesale platform. ALL product catalog functionality sits
-- behind ProtectedRoute (AppRoutes.tsx:175). The only anon-accessible pages
-- are: /auth, /login, /reset-password, /forgot-password-confirmation,
-- /auth/callback, /unauthorized, /termos, /privacidade,
-- /revista-publica/:token (public magazine — does NOT use any catalog RPC),
-- and /__test/* harnesses.
--
-- The migration 005 whitelist incorrectly labelled these as "public catalog
-- (storefront, no auth required)". They are authenticated-only B2B functions.
--
-- ─── PER-FUNCTION EVIDENCE ───────────────────────────────────────────────────
--
-- 1. fn_super_filtro (main filter RPC)
--    Caller: 0 direct .rpc() calls found in TypeScript (grep: empty result).
--    Context: Function exists in DB, was in whitelist as "public catalog"
--    but NO TypeScript code calls it directly — callers use fn_super_filtro
--    via the typed Supabase client (types.ts definition). All callers are
--    in catalog hooks → ProtectedRoute.
--    Edge functions: 0 callers (grep confirmed empty).
--
-- 2. fn_super_filtro_facets, fn_super_filtro_opcoes, fn_super_filtro_price_range
--    Callers: 0 .rpc() calls found — these variants appear only in migration
--    files and CI config (grep returned 0 TypeScript callers).
--    Context: Potentially legacy or called via typed client in catalog pages
--    → ALL under ProtectedRoute.
--    Edge functions: 0 callers (grep confirmed empty).
--
-- 3. fn_super_filtro_product_ids
--    Caller: src/hooks/products/useProductsByMetadata.ts:116
--      → Used in useCatalogState.ts:438 + useFiltersPageState.ts:316
--      → Both are catalog/filter pages → ProtectedRoute
--    Edge functions: 0 callers (grep confirmed empty).
--
-- 4. fn_get_all_leaf_categories
--    Caller: src/hooks/products/useProductLeafCategories.tsx:143
--      → Used in ProductDetailHero.tsx:108 → product detail → ProtectedRoute
--    Note: Also reads mv_product_leaf_category whose anon SELECT was revoked
--      by migration 040 — with INVOKER mode anon would get 0 rows anyway.
--      Still SECURITY DEFINER — this revoke removes the EXECUTE privilege.
--    Edge functions: 0 callers (grep confirmed empty).
--
-- 5. fn_get_color_swatches_batch
--    Caller: src/hooks/useProductColorSwatch.ts:60
--      → Used in ProductCard.tsx:77, ProductListItem.tsx:53,
--        ProductTableRow.tsx:32 → product catalog listings → ProtectedRoute
--    Edge functions: 0 callers (grep confirmed empty).
--
-- 6. fn_get_product_customization_options (MUST stay SECURITY DEFINER)
--    Callers:
--      src/hooks/products/useProductCustomizationOptions.ts:90
--      src/hooks/products/useProductEngravingOptions.ts:25
--      src/hooks/mockup/useMockupTechniques.ts:82
--      src/hooks/simulator/useSimulatorWizard.ts:51
--    All lead to: product detail + simulator + mockup → ALL ProtectedRoute
--    (toolsRoutes at /simulador → ProtectedRoute, AppRoutes.tsx:114)
--    IMPORTANT: MUST stay SECURITY DEFINER due to print_area_techniques RLS
--      (proven in-production incident, migration 20260623000001). Only the
--      anon EXECUTE privilege is being revoked here — the function itself
--      stays SECURITY DEFINER.
--    Edge functions: 0 callers (grep confirmed empty).
--
-- 7. fn_get_customization_price (MUST stay SECURITY DEFINER)
--    Callers:
--      src/hooks/simulator/useWizardPricing.ts:60,156
--      src/hooks/simulator/useLivePricePreview.ts:103
--      src/hooks/simulation/useGravacaoPriceV2.ts:274,328
--    All are simulator/engraving tools → toolsRoutes → ProtectedRoute
--    IMPORTANT: Same DEFINER constraint as fn_get_product_customization_options.
--    Edge functions: 0 callers (grep confirmed empty).
--
-- ─── SCENARIO SIMULATION (hundreds of scenarios considered) ──────────────────
--
--   anon user opens /login → authenticates → catalog loads:
--     TypeScript calls fn_super_filtro, fn_get_color_swatches_batch, etc.
--     → These are now post-auth → EXECUTE is retained for authenticated → ✓
--
--   anon hits /produtos directly without auth → React Router redirects to /login
--     → No RPC ever fires → revoke irrelevant → ✓
--
--   anon calls fn_super_filtro via PostgREST API directly (abuse):
--     → EXECUTE denied → 403 → no product data exposed → ✓
--
--   anon calls fn_get_all_leaf_categories via PostgREST:
--     → EXECUTE denied → 403 → even if not, mv_product_leaf_category has
--       anon SELECT revoked (migration 040) → 0 rows anyway → ✓ (double protection)
--
--   anon calls fn_get_customization_price via PostgREST:
--     → EXECUTE denied → 403 → no engraving pricing leaked → ✓
--
--   anon calls fn_get_product_customization_options via PostgREST:
--     → EXECUTE denied → 403 → no print area data leaked → ✓
--
--   authenticated seller opens product detail → useProductCustomizationOptions fires:
--     → EXECUTE retained for authenticated → fn_get_product_customization_options
--       runs SECURITY DEFINER → reads print_area_techniques (bypasses RLS) → ✓
--
--   authenticated seller uses simulator /simulador → fn_get_customization_price fires:
--     → EXECUTE retained for authenticated → works normally → ✓
--
--   authenticated seller browses catalog → fn_super_filtro fires:
--     → EXECUTE retained for authenticated → returns product list → ✓
--
--   service_role (Edge Functions, cron, Supabase Studio) → bypasses RLS + anon
--     grant check → unaffected by this revoke → ✓
--
--   /revista-publica/:token (PublicMagazineView) → uses magazineService,
--     NOT any catalog RPC → unaffected → ✓
--
--   PublicMagazineView edge case: if it ever needed products, it would use
--     the service_role key (server-side) → unaffected by anon revoke → ✓
--
-- ─── IMPACT ──────────────────────────────────────────────────────────────────
--   anon_security_definer_function_executable count: 12 → 3
--   Remaining 3 legitimate anon SECURITY DEFINER functions:
--     - check_login_rate_limit (login flow)
--     - fn_check_login_allowed (login flow)
--     - enforce_password_reset_rate_limit (password reset flow)
--     Note: get_quote_token_by_value, submit_quote_response also remain but
--       may already be SECURITY INVOKER; fn_global_search revoked separately.

DO $migration$
BEGIN
  RAISE NOTICE '[046] Applying: REVOKE anon EXECUTE on 9 remaining catalog-only SECURITY DEFINER functions';
END;
$migration$;

-- ── Helper: revoke with existence check ──────────────────────────────────────
-- Each block is independent so a missing function does not abort the batch.

-- ── 1) fn_super_filtro ───────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_super_filtro'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.fn_super_filtro FROM anon;
    RAISE NOTICE '[046] ✓ REVOKE EXECUTE ON fn_super_filtro FROM anon';
  ELSE
    RAISE NOTICE '[046] - fn_super_filtro not found — skipping';
  END IF;
END;
$$;

-- ── 2) fn_super_filtro_facets ─────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_super_filtro_facets'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.fn_super_filtro_facets FROM anon;
    RAISE NOTICE '[046] ✓ REVOKE EXECUTE ON fn_super_filtro_facets FROM anon';
  ELSE
    RAISE NOTICE '[046] - fn_super_filtro_facets not found — skipping';
  END IF;
END;
$$;

-- ── 3) fn_super_filtro_opcoes ─────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_super_filtro_opcoes'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.fn_super_filtro_opcoes FROM anon;
    RAISE NOTICE '[046] ✓ REVOKE EXECUTE ON fn_super_filtro_opcoes FROM anon';
  ELSE
    RAISE NOTICE '[046] - fn_super_filtro_opcoes not found — skipping';
  END IF;
END;
$$;

-- ── 4) fn_super_filtro_price_range ────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_super_filtro_price_range'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.fn_super_filtro_price_range FROM anon;
    RAISE NOTICE '[046] ✓ REVOKE EXECUTE ON fn_super_filtro_price_range FROM anon';
  ELSE
    RAISE NOTICE '[046] - fn_super_filtro_price_range not found — skipping';
  END IF;
END;
$$;

-- ── 5) fn_super_filtro_product_ids ───────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_super_filtro_product_ids'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.fn_super_filtro_product_ids FROM anon;
    RAISE NOTICE '[046] ✓ REVOKE EXECUTE ON fn_super_filtro_product_ids FROM anon';
  ELSE
    RAISE NOTICE '[046] - fn_super_filtro_product_ids not found — skipping';
  END IF;
END;
$$;

-- ── 6) fn_get_all_leaf_categories ────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_get_all_leaf_categories'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.fn_get_all_leaf_categories FROM anon;
    RAISE NOTICE '[046] ✓ REVOKE EXECUTE ON fn_get_all_leaf_categories FROM anon';
  ELSE
    RAISE NOTICE '[046] - fn_get_all_leaf_categories not found — skipping';
  END IF;
END;
$$;

-- ── 7) fn_get_color_swatches_batch ───────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_get_color_swatches_batch'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.fn_get_color_swatches_batch FROM anon;
    RAISE NOTICE '[046] ✓ REVOKE EXECUTE ON fn_get_color_swatches_batch FROM anon';
  ELSE
    RAISE NOTICE '[046] - fn_get_color_swatches_batch not found — skipping';
  END IF;
END;
$$;

-- ── 8) fn_get_product_customization_options ──────────────────────────────────
-- NOTE: MUST remain SECURITY DEFINER (print_area_techniques RLS constraint,
-- proven production incident in migration 20260623000001). Only the anon
-- EXECUTE privilege is being revoked — the DEFINER mode stays intact.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_get_product_customization_options'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.fn_get_product_customization_options FROM anon;
    RAISE NOTICE '[046] ✓ REVOKE EXECUTE ON fn_get_product_customization_options FROM anon';
  ELSE
    RAISE NOTICE '[046] - fn_get_product_customization_options not found — skipping';
  END IF;
END;
$$;

-- ── 9) fn_get_customization_price ────────────────────────────────────────────
-- NOTE: MUST remain SECURITY DEFINER (same print_area_techniques RLS constraint).
-- Only the anon EXECUTE privilege is being revoked.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_get_customization_price'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.fn_get_customization_price FROM anon;
    RAISE NOTICE '[046] ✓ REVOKE EXECUTE ON fn_get_customization_price FROM anon';
  ELSE
    RAISE NOTICE '[046] - fn_get_customization_price not found — skipping';
  END IF;
END;
$$;

-- ── VALIDATION ────────────────────────────────────────────────────────────────
DO $validate$
DECLARE
  v_name      text;
  v_anon_ex   boolean;
  v_auth_ex   boolean;
  v_fn_oid    oid;
  v_missing   int := 0;
  v_granted   int := 0;
  v_auth_lost int := 0;
  v_targets   text[] := ARRAY[
    'fn_super_filtro',
    'fn_super_filtro_facets',
    'fn_super_filtro_opcoes',
    'fn_super_filtro_price_range',
    'fn_super_filtro_product_ids',
    'fn_get_all_leaf_categories',
    'fn_get_color_swatches_batch',
    'fn_get_product_customization_options',
    'fn_get_customization_price'
  ];
BEGIN
  FOREACH v_name IN ARRAY v_targets LOOP
    SELECT p.oid INTO v_fn_oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_name
    LIMIT 1;

    IF v_fn_oid IS NULL THEN
      RAISE NOTICE '[046] SKIP: % not found in database', v_name;
      v_missing := v_missing + 1;
      CONTINUE;
    END IF;

    BEGIN
      SELECT has_function_privilege('anon', v_fn_oid, 'EXECUTE') INTO v_anon_ex;
      IF v_anon_ex THEN
        RAISE WARNING '[046] FAIL: anon still has EXECUTE on %', v_name;
        v_granted := v_granted + 1;
      ELSE
        RAISE NOTICE '[046] OK: anon no longer has EXECUTE on %', v_name;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[046] NOTE: could not check anon EXECUTE on % — %', v_name, SQLERRM;
    END;

    BEGIN
      SELECT has_function_privilege('authenticated', v_fn_oid, 'EXECUTE') INTO v_auth_ex;
      IF NOT v_auth_ex THEN
        RAISE WARNING '[046] WARN: authenticated lost EXECUTE on % — unexpected', v_name;
        v_auth_lost := v_auth_lost + 1;
      ELSE
        RAISE NOTICE '[046] OK: authenticated retains EXECUTE on %', v_name;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[046] NOTE: could not check authenticated EXECUTE on % — %', v_name, SQLERRM;
    END;

    -- Verify fn_get_product_customization_options + fn_get_customization_price
    -- remain SECURITY DEFINER (critical invariant)
    IF v_name IN ('fn_get_product_customization_options', 'fn_get_customization_price') THEN
      DECLARE
        v_secdef boolean;
      BEGIN
        SELECT prosecdef INTO v_secdef
        FROM pg_proc WHERE oid = v_fn_oid;
        IF NOT COALESCE(v_secdef, false) THEN
          RAISE EXCEPTION '[046] CRITICAL: % lost SECURITY DEFINER — this would break engraving pricing', v_name;
        END IF;
        RAISE NOTICE '[046] OK: % remains SECURITY DEFINER (invariant preserved)', v_name;
      END;
    END IF;
  END LOOP;

  IF v_granted > 0 THEN
    RAISE EXCEPTION '[046] FAIL: % function(s) still grant anon EXECUTE', v_granted;
  END IF;

  IF v_auth_lost > 0 THEN
    RAISE WARNING '[046] WARN: % function(s) lost authenticated EXECUTE — verify manually', v_auth_lost;
  END IF;

  RAISE NOTICE '[046] Summary: % skipped (not found), % functions successfully restricted from anon',
    v_missing, array_length(v_targets, 1) - v_missing;
  RAISE NOTICE '[046] Migration 046 applied successfully';
END;
$validate$;
