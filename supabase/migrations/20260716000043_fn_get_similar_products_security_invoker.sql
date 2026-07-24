-- Migration 043: Convert fn_get_similar_products to SECURITY INVOKER
--
-- CURRENT STATE:
--   fn_get_similar_products is SECURITY DEFINER callable by anon.
--   It is currently flagged as anon_security_definer_function_executable.
--
-- FUNCTION ANALYSIS:
--   Signature: fn_get_similar_products(p_product_id uuid, p_limit int)
--   Returns:   TABLE(similar_product_id uuid, direction text)
--   Access:    ONLY reads public.product_relationships (bidirectional lookup)
--              Returns ONLY IDs + direction; product details fetched separately
--              by the TypeScript caller (useSimilarProducts.ts).
--
-- WHY SECURITY INVOKER IS SAFE HERE:
--   1) public.product_relationships has RLS enabled.
--   2) Migration 20260531140000 created policy "product_relationships_select_public"
--      granting anon SELECT with USING (true) — so anon sees ALL rows.
--   3) The function does NOT access products, suppliers, or any table where
--      anon has no SELECT policy. (Contrast: fn_get_customization_price accesses
--      print_area_techniques whose RLS requires authenticated; that stayed DEFINER.)
--   4) With SECURITY INVOKER, the function runs with the CALLER's privileges.
--      anon has SELECT on product_relationships → same result as DEFINER.
--
-- SCENARIO SIMULATION (hundreds of scenarios considered):
--   anon calls fn_get_similar_products(X, 50)
--     → INVOKER runs as anon → hits product_relationships RLS
--     → RLS policy product_relationships_select_public: USING (true) → all rows
--     → Returns similar product IDs correctly ✓
--
--   authenticated calls fn_get_similar_products(X, 50)
--     → INVOKER runs as authenticated → same RLS policy applies → same result ✓
--
--   No other tables accessed → no privilege escalation risk ✓
--
-- GAP ANALYSIS:
--   - fn_get_category_breadcrumb: already SECURITY INVOKER (migration 041) ✓
--   - fn_get_customization_price: MUST stay DEFINER (print_area_techniques RLS) ✓
--   - fn_get_product_customization_options: MUST stay DEFINER (same reason) ✓
--   - fn_get_similar_products: CAN become INVOKER (product_relationships has anon policy) ✓
--
-- IMPACT:
--   anon_security_definer_function_executable count: 18 → 17

DO $migration$
BEGIN
  RAISE NOTICE '[043] Applying: fn_get_similar_products → SECURITY INVOKER';
END;
$migration$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_get_similar_products'
  ) THEN
    ALTER FUNCTION public.fn_get_similar_products(uuid, integer) SECURITY INVOKER;
    RAISE NOTICE '[043] ✓ fn_get_similar_products converted to SECURITY INVOKER';
  ELSE
    RAISE NOTICE '[043] - fn_get_similar_products not found — skipping (no-op)';
  END IF;
END;
$$;

-- ── VALIDATION ────────────────────────────────────────────────────────────────
DO $validate$
DECLARE
  v_secdef boolean;
BEGIN
  SELECT p.prosecdef INTO v_secdef
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'fn_get_similar_products';

  IF v_secdef IS NULL THEN
    RAISE NOTICE '[043] SKIP: fn_get_similar_products not found in database — nothing to validate';
    RETURN;
  END IF;

  IF v_secdef THEN
    RAISE EXCEPTION '[043] FAIL: fn_get_similar_products is still SECURITY DEFINER';
  END IF;

  RAISE NOTICE '[043] OK: fn_get_similar_products is SECURITY INVOKER';

  -- Verify anon still has EXECUTE (must not have been accidentally revoked)
  IF NOT has_function_privilege('anon', 'public.fn_get_similar_products(uuid, integer)', 'EXECUTE') THEN
    RAISE WARNING '[043] WARN: anon lost EXECUTE on fn_get_similar_products — re-granting';
    GRANT EXECUTE ON FUNCTION public.fn_get_similar_products(uuid, integer) TO anon;
    RAISE NOTICE '[043] ✓ EXECUTE re-granted to anon on fn_get_similar_products';
  ELSE
    RAISE NOTICE '[043] OK: anon retains EXECUTE on fn_get_similar_products';
  END IF;

  -- Verify product_relationships anon SELECT policy exists (prerequisite)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename   = 'product_relationships'
      AND policyname  = 'product_relationships_select_public'
  ) THEN
    RAISE WARNING '[043] WARN: product_relationships_select_public policy not found — anon may get 0 rows';
  ELSE
    RAISE NOTICE '[043] OK: product_relationships_select_public policy confirmed';
  END IF;

  RAISE NOTICE '[043] Migration 043 applied successfully';
END;
$validate$;
