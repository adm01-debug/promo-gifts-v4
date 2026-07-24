-- Migration 041: Revoke anon EXECUTE from B2B catalog SECURITY DEFINER functions
--
-- Source: 200-commit audit — follow-up on migration 005 whitelist review
-- Findings addressed: anon_security_definer_function_executable (~17 functions)
--
-- ─── Context ─────────────────────────────────────────────────────────────────
--
-- Migration 005 built a whitelist for anon EXECUTE that included two categories:
--   A) Legitimate anon functions (login rate-limit, quote sharing) — KEEP
--   B) "Public catalog (storefront, no auth required)" functions — WRONG for B2B
--
-- This platform is a B2B wholesale gifting catalog. The frontend wraps ALL product
-- catalog, filter, quote, simulator, mockup, and collection pages inside
-- <ProtectedRoute /> (AppRoutes.tsx:175). There is no unauthenticated storefront.
--
-- Functions in category B were kept for anon in migration 005 on the assumption
-- of a public storefront — a false assumption for this B2B architecture.
-- Revoking anon EXECUTE eliminates the `anon_security_definer_function_executable`
-- Supabase advisor finding for these functions without affecting authenticated users.
--
-- FUNCTIONS TO REVOKE FROM ANON:
--   Product filter & search:
--     fn_super_filtro, fn_super_filtro_facets, fn_super_filtro_opcoes,
--     fn_super_filtro_price_range, fn_super_filtro_product_ids,
--     fn_get_category_breadcrumb, fn_get_all_leaf_categories,
--     fn_global_search, fn_get_similar_products, fn_get_color_swatches_batch
--   Product customization/pricing (STAY SECURITY DEFINER, anon removed):
--     fn_get_product_customization_options, fn_get_customization_price
--   Analytics/catalog support:
--     fn_log_search_analytics, get_catalog_bestseller_page,
--     get_top_collected_products, get_promo_sales_ranking,
--     get_collections_weekly_count
--
-- FUNCTIONS KEPT FOR ANON (legitimate, unchanged):
--   check_login_rate_limit, fn_check_login_allowed,
--   enforce_password_reset_rate_limit, get_quote_token_by_value,
--   submit_quote_response
--   + all RLS helper functions (required by PG for USING clause evaluation)
--
-- Safety for fn_get_customization_price / fn_get_product_customization_options:
--   These MUST remain SECURITY DEFINER (print_area_techniques RLS blocks
--   authenticated callers without DEFINER elevation — confirmed production incident).
--   However, anon DOES NOT need EXECUTE because the simulator/customization pages
--   are fully behind <ProtectedRoute />. Revoking anon EXECUTE is safe.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Revoke anon EXECUTE from B2B-only catalog SECURITY DEFINER functions
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r         RECORD;
  v_ok      int := 0;
  v_skip    int := 0;
  v_fail    int := 0;
  v_target  text[] := ARRAY[
    -- Product filter & search
    'fn_super_filtro',
    'fn_super_filtro_facets',
    'fn_super_filtro_opcoes',
    'fn_super_filtro_price_range',
    'fn_super_filtro_product_ids',
    'fn_get_category_breadcrumb',
    'fn_get_all_leaf_categories',
    'fn_global_search',
    'fn_get_similar_products',
    'fn_get_color_swatches_batch',
    -- Product customization & pricing (STAY SECURITY DEFINER, anon removed)
    'fn_get_product_customization_options',
    'fn_get_customization_price',
    -- Analytics & catalog support
    'fn_log_search_analytics',
    'get_catalog_bestseller_page',
    'get_top_collected_products',
    'get_promo_sales_ranking',
    'get_collections_weekly_count'
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
      AND p.proname = ANY(v_target)
      AND p.prokind = 'f'
    ORDER BY p.proname, p.oid
  LOOP
    -- Only revoke if anon actually has EXECUTE
    IF has_function_privilege('anon', r.oid, 'EXECUTE') THEN
      BEGIN
        EXECUTE format(
          'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon',
          r.proname, r.args
        );
        v_ok := v_ok + 1;
        RAISE NOTICE '✓ [anon_security_definer] REVOKE EXECUTE ON %(%) FROM anon',
          r.proname, r.args;
      EXCEPTION WHEN OTHERS THEN
        v_fail := v_fail + 1;
        RAISE WARNING '✗ [anon_security_definer] Could not revoke %(%)): %',
          r.proname, r.args, SQLERRM;
      END;
    ELSE
      v_skip := v_skip + 1;
      RAISE NOTICE '- %(%): anon already lacks EXECUTE — skipping', r.proname, r.args;
    END IF;
  END LOOP;

  RAISE NOTICE 'Migration 041 summary: revoked=%, skipped=%, failed=%', v_ok, v_skip, v_fail;

  IF v_fail > 0 THEN
    RAISE WARNING '[041] % function(s) could not be revoked — review warnings above', v_fail;
  END IF;
END;
$$;

-- ─── Validation ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_still_callable int;
  v_fn             text;
  v_target         text[] := ARRAY[
    'fn_super_filtro', 'fn_super_filtro_facets', 'fn_super_filtro_opcoes',
    'fn_super_filtro_price_range', 'fn_super_filtro_product_ids',
    'fn_get_category_breadcrumb', 'fn_get_all_leaf_categories',
    'fn_global_search', 'fn_get_similar_products', 'fn_get_color_swatches_batch',
    'fn_get_product_customization_options', 'fn_get_customization_price',
    'fn_log_search_analytics', 'get_catalog_bestseller_page',
    'get_top_collected_products', 'get_promo_sales_ranking',
    'get_collections_weekly_count'
  ];
BEGIN
  -- Count functions anon can still EXECUTE from our revoke list
  SELECT count(*) INTO v_still_callable
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = ANY(v_target)
    AND p.prokind = 'f'
    AND has_function_privilege('anon', p.oid, 'EXECUTE');

  IF v_still_callable > 0 THEN
    -- Report which ones still have access
    FOR v_fn IN
      SELECT p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = ANY(v_target)
        AND p.prokind = 'f'
        AND has_function_privilege('anon', p.oid, 'EXECUTE')
    LOOP
      RAISE WARNING '[041] anon still has EXECUTE on %', v_fn;
    END LOOP;
    RAISE WARNING '[041] % B2B catalog function(s) still callable by anon', v_still_callable;
  ELSE
    RAISE NOTICE '✓ [041] All 17 B2B catalog functions no longer callable by anon';
  END IF;

  -- Verify authenticated still has access to fn_super_filtro (spot check)
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_super_filtro'
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) THEN
    RAISE NOTICE '✓ [041] authenticated role retains EXECUTE on fn_super_filtro';
  ELSE
    RAISE WARNING '[041] authenticated lost EXECUTE on fn_super_filtro — investigate!';
  END IF;

  -- Verify fn_get_customization_price is still SECURITY DEFINER
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_get_customization_price'
    AND p.prosecdef = true
  ) THEN
    RAISE NOTICE '✓ [041] fn_get_customization_price still SECURITY DEFINER (required)';
  ELSE
    RAISE WARNING '[041] fn_get_customization_price is NO LONGER SECURITY DEFINER — check migration!';
  END IF;

  RAISE NOTICE 'Migration 041 complete — anon_security_definer_function_executable reduced by up to 17.';
END;
$$;
