-- Migration: fix_canonical_root_soft_delete_20260619
-- Purpose: Gap fix discovered during exhaustive testing — when a canonical root is
-- soft-deleted (deleted_at set), dependents continue pointing to the deleted row,
-- which violates invariant C13 (canonical_not_deleted).
-- Fix: AFTER UPDATE OF deleted_at trigger that promotes the oldest active dependent
-- to root and re-points other dependents to that new root.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_handle_canonical_root_soft_delete()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_new_root uuid;
BEGIN
  -- Pick oldest active dep to promote
  SELECT id INTO v_new_root
  FROM public.product_images
  WHERE canonical_image_id = NEW.id
    AND deleted_at IS NULL
  ORDER BY created_at ASC, id ASC
  LIMIT 1;

  IF v_new_root IS NOT NULL THEN
    -- Promote oldest dep to root
    UPDATE public.product_images
    SET canonical_image_id = NULL,
        is_shared = false,
        last_modified_source = 'edge_function',
        updated_at = now()
    WHERE id = v_new_root;

    -- Re-point all other deps to new root
    UPDATE public.product_images
    SET canonical_image_id = v_new_root,
        last_modified_source = 'edge_function',
        updated_at = now()
    WHERE canonical_image_id = NEW.id
      AND id <> v_new_root
      AND deleted_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_handle_canonical_root_soft_delete() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_handle_canonical_root_soft_delete() TO service_role;

DROP TRIGGER IF EXISTS trg_handle_root_soft_delete ON public.product_images;
CREATE TRIGGER trg_handle_root_soft_delete
  AFTER UPDATE OF deleted_at
  ON public.product_images
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL AND NEW.canonical_image_id IS NULL)
  EXECUTE FUNCTION public.fn_handle_canonical_root_soft_delete();

COMMIT;
