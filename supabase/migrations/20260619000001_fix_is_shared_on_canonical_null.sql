-- Migration: fix_is_shared_on_canonical_null_20260619
-- Purpose: Gap fix discovered during exhaustive testing — hard-delete of canonical root
-- triggers FK ON DELETE SET NULL on dependent rows' canonical_image_id, but leaves
-- is_shared=true. That state violates invariant C09 (is_shared=true must have canonical).
-- Fix: BEFORE UPDATE trigger that resets is_shared to false whenever
--      canonical_image_id transitions from NOT NULL to NULL.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_reset_is_shared_on_canonical_null()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.canonical_image_id IS NULL AND OLD.canonical_image_id IS NOT NULL THEN
    NEW.is_shared := false;
    NEW.last_modified_source := COALESCE(NULLIF(NEW.last_modified_source, ''), 'edge_function');
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_reset_is_shared_on_canonical_null() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reset_is_shared_on_canonical_null() TO service_role;

DROP TRIGGER IF EXISTS trg_reset_is_shared_on_canonical_null ON public.product_images;
CREATE TRIGGER trg_reset_is_shared_on_canonical_null
  BEFORE UPDATE OF canonical_image_id
  ON public.product_images
  FOR EACH ROW
  WHEN (NEW.canonical_image_id IS NULL AND OLD.canonical_image_id IS NOT NULL)
  EXECUTE FUNCTION public.fn_reset_is_shared_on_canonical_null();

COMMIT;
