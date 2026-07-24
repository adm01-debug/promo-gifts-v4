-- Migration: link_residual_groups_and_autolink_trigger_20260618
-- Purpose: Auto-link trigger for future canonical dedup + reconcile_cf_image_status function
-- Creates:
--   fn_autolink_canonical_on_content_hash() — BEFORE UPDATE trigger function
--   trg_autolink_canonical_on_content_hash — fires on UPDATE OF content_hash
--   reconcile_cf_image_status(p_cf_id, p_exists) — edge function callable reconciler

BEGIN;

-- Auto-link trigger function: links image to canonical group when content_hash is first populated
CREATE OR REPLACE FUNCTION public.fn_autolink_canonical_on_content_hash()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_root_id uuid;
BEGIN
  -- Only act when content_hash is being set for the first time
  IF NEW.content_hash IS NULL OR (OLD.content_hash IS NOT NULL AND OLD.content_hash = NEW.content_hash) THEN
    RETURN NEW;
  END IF;
  -- Do not override an existing canonical assignment
  IF NEW.canonical_image_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Find the oldest root in the group (is_shared=false, canonical_image_id=NULL)
  SELECT id INTO v_root_id
  FROM public.product_images
  WHERE content_hash = NEW.content_hash
    AND deleted_at IS NULL
    AND canonical_image_id IS NULL
    AND id <> NEW.id
    AND is_shared = false
  ORDER BY created_at ASC, id ASC
  LIMIT 1;

  IF v_root_id IS NOT NULL THEN
    NEW.canonical_image_id := v_root_id;
    NEW.is_shared := true;
  ELSE
    -- Fallback: inherit root from existing dependent in same group
    SELECT pi2.canonical_image_id INTO v_root_id
    FROM public.product_images pi2
    WHERE pi2.content_hash = NEW.content_hash
      AND pi2.deleted_at IS NULL
      AND pi2.canonical_image_id IS NOT NULL
      AND pi2.id <> NEW.id
    LIMIT 1;

    IF v_root_id IS NOT NULL THEN
      NEW.canonical_image_id := v_root_id;
      NEW.is_shared := true;
    END IF;
    -- If only member → remain as root
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_autolink_canonical_on_content_hash() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_autolink_canonical_on_content_hash() TO service_role;

DROP TRIGGER IF EXISTS trg_autolink_canonical_on_content_hash ON public.product_images;
CREATE TRIGGER trg_autolink_canonical_on_content_hash
  BEFORE UPDATE OF content_hash
  ON public.product_images
  FOR EACH ROW
  WHEN (NEW.content_hash IS NOT NULL AND (OLD.content_hash IS NULL OR OLD.content_hash <> NEW.content_hash))
  EXECUTE FUNCTION public.fn_autolink_canonical_on_content_hash();

-- Reconcile function: called by edge function after CF verification check
CREATE OR REPLACE FUNCTION public.reconcile_cf_image_status(p_cf_id text, p_exists boolean)
RETURNS TABLE(action text, rows_affected integer)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_now timestamptz := now();
  v_rows int := 0;
BEGIN
  IF p_exists THEN
    UPDATE public.product_images
    SET
      cf_sync_status      = 'verified',
      cf_verified_at      = COALESCE(cf_verified_at, v_now),
      cf_last_checked_at  = v_now,
      cf_last_error       = NULL,
      last_modified_source = 'edge_function',
      updated_at          = v_now
    WHERE cloudflare_image_id = p_cf_id
      AND deleted_at IS NULL
      AND cf_sync_status <> 'verified';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN QUERY SELECT 'mark_verified'::text, v_rows;
  ELSE
    UPDATE public.product_images
    SET
      cf_sync_status      = 'missing',
      cf_check_attempts   = cf_check_attempts + 1,
      cf_last_checked_at  = v_now,
      cf_last_error       = COALESCE(cf_last_error, '') || ' | ' || v_now::text || ' recon: not_found_in_cloudflare',
      last_modified_source = 'edge_function',
      updated_at          = v_now
    WHERE cloudflare_image_id = p_cf_id
      AND deleted_at IS NULL
      AND cf_sync_status = 'verified';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN QUERY SELECT 'mark_missing'::text, v_rows;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconcile_cf_image_status(text, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_cf_image_status(text, boolean) TO service_role;

COMMIT;
