-- Migration 072: Fix cron job + fn_get_all_leaf_categories after MV moved to internal
--
-- Source: Codex P1 review on PR #1730
-- Findings addressed:
--   • refresh-mv-product-leaf-category pg_cron job still points to
--     public.mv_product_leaf_category which was dropped by migration 070
--   • fn_get_all_leaf_categories() reads public.mv_product_leaf_category
--     directly — fails with "relation does not exist" after the drop
--
-- ─── Fix 1: Retarget the pg_cron refresh job ─────────────────────────────────
--
-- Migration 070 moved the MV to internal schema and dropped the public one.
-- The pg_cron job was created by 20260618200000_drift_catalog_analytics_baseline.sql
-- with command: fn_cron_safe_run(..., 'REFRESH MATERIALIZED VIEW CONCURRENTLY
--   public.mv_product_leaf_category;', ...).
-- We update the command in-place via cron.alter_job or by unschedule/reschedule.
--
-- ─── Fix 2: Repoint fn_get_all_leaf_categories() ────────────────────────────
--
-- The function reads public.mv_product_leaf_category via search_path='public'.
-- Update to read internal.mv_product_leaf_category with an explicit schema ref.
-- Return signature is preserved identically (leaf_category_parent_id included).
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
-- cron.unschedule + cron.schedule pair is the idempotent pattern used throughout.
-- CREATE OR REPLACE FUNCTION is idempotent.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Fix 1: Retarget pg_cron job to internal.mv_product_leaf_category
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_job_id bigint;
  v_schedule text;
BEGIN
  -- Get current job info
  SELECT jobid, schedule
  INTO v_job_id, v_schedule
  FROM cron.job
  WHERE jobname = 'refresh-mv-product-leaf-category';

  IF NOT FOUND THEN
    -- Job doesn't exist; create it pointing to internal schema
    PERFORM cron.schedule(
      'refresh-mv-product-leaf-category',
      '37 */4 * * *',
      $cmd$SELECT public.fn_cron_safe_run(0::bigint, 'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_product_leaf_category;', 55000, 'mv-leaf-category');$cmd$
    );
    RAISE NOTICE '[072] Created new cron job for internal.mv_product_leaf_category';
    RETURN;
  END IF;

  -- Remove old job and recreate with internal schema reference
  PERFORM cron.unschedule(v_job_id);

  PERFORM cron.schedule(
    'refresh-mv-product-leaf-category',
    v_schedule,
    $cmd$SELECT public.fn_cron_safe_run(0::bigint, 'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_product_leaf_category;', 55000, 'mv-leaf-category');$cmd$
  );

  RAISE NOTICE '[072] Retargeted cron job refresh-mv-product-leaf-category → internal.mv_product_leaf_category (schedule: %)', v_schedule;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Fix 2: Repoint fn_get_all_leaf_categories() to internal schema
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_get_all_leaf_categories()
RETURNS TABLE(
  product_id            uuid,
  leaf_category_id      uuid,
  leaf_category_name    text,
  leaf_category_level   integer,
  leaf_category_parent_id uuid,
  leaf_category_slug    text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'internal'
AS $$
  SELECT
    product_id,
    leaf_category_id,
    leaf_category_name,
    leaf_category_level,
    leaf_category_parent_id,
    leaf_category_slug
  FROM internal.mv_product_leaf_category;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Validate
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_cron_cmd  text;
  v_fn_src    text;
BEGIN
  -- Verify cron job now references internal schema
  SELECT command INTO v_cron_cmd
  FROM cron.job
  WHERE jobname = 'refresh-mv-product-leaf-category';

  IF v_cron_cmd LIKE '%internal.mv_product_leaf_category%' THEN
    RAISE NOTICE '[072] ✓ cron job references internal.mv_product_leaf_category';
  ELSE
    RAISE WARNING '[072] ✗ cron job command unexpected: %', v_cron_cmd;
  END IF;

  -- Verify function body now references internal schema
  SELECT pg_get_functiondef(oid) INTO v_fn_src
  FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace AND proname = 'fn_get_all_leaf_categories';

  IF v_fn_src LIKE '%internal.mv_product_leaf_category%' THEN
    RAISE NOTICE '[072] ✓ fn_get_all_leaf_categories reads internal.mv_product_leaf_category';
  ELSE
    RAISE WARNING '[072] ✗ fn_get_all_leaf_categories body unexpected';
  END IF;

  RAISE NOTICE 'Migration 072 complete.';
END;
$$;
