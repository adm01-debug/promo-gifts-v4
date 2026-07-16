-- Migration 038: Fix remaining auth_rls_initplan + unindexed FK on collection_products
--
-- Source: 200-commit audit + performance advisor follow-up (post-037 score check)
-- Findings addressed: 2
--   1) auth_rls_initplan (1 finding) — smoke_insert_service_role on smoke_test_runs
--   2) unindexed_foreign_keys (1 finding) — collection_products_product_id_fkey1
--
-- ─── Finding 1: auth_rls_initplan ────────────────────────────────────────────
--
-- Migration 033 already wrapped current_setting() and is_admin_or_above() in
-- (SELECT ...) subqueries, but left auth.uid() unwrapped *inside* the function:
--
--   ( SELECT is_admin_or_above(auth.uid()) )   ← auth.uid() re-evaluated per row
--
-- The advisor still flags this because auth.uid() inside the function argument is
-- not hoisted as its own InitPlan. The correct pattern is:
--
--   ( SELECT is_admin_or_above((SELECT auth.uid())) )
--
-- With this pattern, (SELECT auth.uid()) becomes a scalar InitPlan (evaluated once
-- per statement), and its result is passed to is_admin_or_above(), which is itself
-- hoisted as an InitPlan via the outer (SELECT ...).
--
-- ─── Finding 2: unindexed_foreign_keys ───────────────────────────────────────
--
-- collection_products.product_id (FK: collection_products_product_id_fkey1)
-- lacks a covering index. Migration 037 attempted to create
-- idx_collection_products_product_id but that name was already taken by
-- b2b_collection_products in the same schema (PostgreSQL index names are
-- schema-unique). The IF NOT EXISTS silently skipped creation.
-- Fix: use name idx_col_prods_product_id (distinct, within 63-char limit).

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1) Fix auth_rls_initplan: smoke_insert_service_role
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'smoke_test_runs'
      AND c.relkind IN ('r', 'p')
  ) THEN
    DROP POLICY IF EXISTS smoke_insert_service_role ON public.smoke_test_runs;

    CREATE POLICY smoke_insert_service_role ON public.smoke_test_runs
      FOR INSERT TO authenticated
      WITH CHECK (
        (SELECT current_setting('request.jwt.claim.role', true)) = 'service_role'
        OR (SELECT is_admin_or_above((SELECT auth.uid())))
      );

    RAISE NOTICE '✓ [auth_rls_initplan] smoke_insert_service_role: auth.uid() now wrapped in its own InitPlan subquery';
  ELSE
    RAISE NOTICE '- public.smoke_test_runs not found — skipping';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2) Fix unindexed FK: collection_products.product_id
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'collection_products'
      AND c.relkind IN ('r', 'p')
  ) THEN
    -- Name 'idx_collection_products_product_id' already taken by b2b_collection_products
    -- in the public schema. Using distinct abbreviated name.
    CREATE INDEX IF NOT EXISTS idx_col_prods_product_id
      ON public.collection_products (product_id);

    RAISE NOTICE '✓ [unindexed_foreign_keys] idx_col_prods_product_id created on collection_products(product_id)';
  ELSE
    RAISE NOTICE '- public.collection_products not found — skipping';
  END IF;
END;
$$;

-- ─── Validation ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  wc_expr      text;
  idx_exists   boolean;
BEGIN
  -- 1) Verify policy WITH CHECK expression
  SELECT pg_get_expr(polwithcheck, polrelid)
  INTO wc_expr
  FROM pg_policy
  WHERE polname = 'smoke_insert_service_role'
    AND polrelid = 'public.smoke_test_runs'::regclass;

  IF wc_expr IS NULL THEN
    RAISE WARNING 'Policy smoke_insert_service_role not found on smoke_test_runs';
  ELSIF wc_expr NOT LIKE '%(SELECT auth.uid())%' THEN
    RAISE WARNING 'Policy smoke_insert_service_role may still have un-wrapped auth.uid(): %', wc_expr;
  ELSE
    RAISE NOTICE '✓ smoke_insert_service_role WITH CHECK: %', wc_expr;
  END IF;

  -- 2) Verify FK covering index
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'collection_products'
      AND indexname  = 'idx_col_prods_product_id'
  ) INTO idx_exists;

  IF idx_exists THEN
    RAISE NOTICE '✓ idx_col_prods_product_id confirmed on collection_products';
  ELSE
    RAISE WARNING 'idx_col_prods_product_id NOT FOUND on collection_products';
  END IF;

  RAISE NOTICE 'Migration 038 complete — auth_rls_initplan + unindexed_foreign_keys should clear on next advisor run.';
END;
$$;
