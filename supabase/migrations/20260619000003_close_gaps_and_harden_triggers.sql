-- Migration: close_gaps_and_harden_triggers_20260619
-- Purpose: Close 3 gaps found in deep simulation round 2 (200+ scenarios)
--   GAP-B6: Restoration of dep pointing to deleted canonical → C13 violation
--   GAP-C3: Hash change on already-linked dep → stays in wrong canonical group
--   GAP-D:  Direct UPDATE canonical_image_id to non-root → creates chain (C07)
-- Also adds idx_pi_canonical_active for trigger query performance

BEGIN;

-- ══════════════════════════════════════════════════════════════════════
-- INDEX: Optimize trigger query pattern (canonical_image_id + deleted_at filter)
-- ══════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_pi_canonical_active
  ON public.product_images (canonical_image_id, created_at ASC, id ASC)
  WHERE canonical_image_id IS NOT NULL AND deleted_at IS NULL;

-- ══════════════════════════════════════════════════════════════════════
-- FIX GAP-B6: Image restoration trigger
-- When a soft-deleted dep is restored, if its canonical is also deleted,
-- clear the stale canonical assignment to prevent C13 violations.
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_handle_image_restoration()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_canon_deleted boolean;
BEGIN
  -- Only act on restoration (deleted → live)
  IF NEW.deleted_at IS NOT NULL OR OLD.deleted_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- If image has a canonical assignment, check if that root is still alive
  IF NEW.canonical_image_id IS NOT NULL THEN
    SELECT (deleted_at IS NOT NULL) INTO v_canon_deleted
    FROM public.product_images
    WHERE id = NEW.canonical_image_id;

    IF v_canon_deleted IS TRUE THEN
      -- Stale canonical: canonical was deleted after this dep was soft-deleted.
      -- Detach: make this image a standalone root.
      NEW.canonical_image_id := NULL;
      NEW.is_shared := false;
      NEW.last_modified_source := COALESCE(NULLIF(NEW.last_modified_source, ''), 'edge_function');
      NEW.updated_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_handle_image_restoration() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_handle_image_restoration() TO service_role;

DROP TRIGGER IF EXISTS trg_handle_image_restoration ON public.product_images;
CREATE TRIGGER trg_handle_image_restoration
  BEFORE UPDATE OF deleted_at
  ON public.product_images
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL AND NEW.canonical_image_id IS NOT NULL)
  EXECUTE FUNCTION public.fn_handle_image_restoration();

-- ══════════════════════════════════════════════════════════════════════
-- FIX GAP-D: Canonical chain prevention trigger
-- When canonical_image_id is set to a dep (non-root), auto-flatten to the root.
-- Silently corrects chain creation without throwing an error.
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_prevent_canonical_chain()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_target_canonical uuid;
BEGIN
  -- Check if the target (NEW.canonical_image_id) is itself a dep
  SELECT canonical_image_id INTO v_target_canonical
  FROM public.product_images
  WHERE id = NEW.canonical_image_id;

  IF v_target_canonical IS NOT NULL THEN
    -- Target is a dep → flatten: point directly to the target's root
    NEW.canonical_image_id := v_target_canonical;
  END IF;

  -- Prevent self-referential assignment
  IF NEW.canonical_image_id = NEW.id THEN
    NEW.canonical_image_id := NULL;
    NEW.is_shared := false;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_prevent_canonical_chain() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_prevent_canonical_chain() TO service_role;

DROP TRIGGER IF EXISTS trg_prevent_canonical_chain ON public.product_images;
CREATE TRIGGER trg_prevent_canonical_chain
  BEFORE UPDATE OF canonical_image_id
  ON public.product_images
  FOR EACH ROW
  WHEN (
    NEW.canonical_image_id IS NOT NULL
    AND NEW.canonical_image_id IS DISTINCT FROM OLD.canonical_image_id
    AND NEW.canonical_image_id <> NEW.id
  )
  EXECUTE FUNCTION public.fn_prevent_canonical_chain();

-- ══════════════════════════════════════════════════════════════════════
-- FIX GAP-C3: Update autolink trigger to handle hash changes on linked deps
-- When content_hash changes on an already-linked dep, clear old canonical
-- so the trigger can find the correct new root for the new hash.
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_autolink_canonical_on_content_hash()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_root_id uuid;
BEGIN
  -- Only act when content_hash is being set or changed
  IF NEW.content_hash IS NULL OR (OLD.content_hash IS NOT NULL AND OLD.content_hash = NEW.content_hash) THEN
    RETURN NEW;
  END IF;

  -- If image already has a canonical assignment:
  IF NEW.canonical_image_id IS NOT NULL THEN
    -- If hash CHANGED (not first-set): clear old canonical so we can re-link to correct group
    IF OLD.content_hash IS NOT NULL AND OLD.content_hash IS DISTINCT FROM NEW.content_hash THEN
      NEW.canonical_image_id := NULL;
      NEW.is_shared := false;
      -- Fall through to find new root for new hash
    ELSE
      -- First-set (OLD was NULL): respect existing canonical assignment
      RETURN NEW;
    END IF;
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
    -- If only member → remain as standalone root
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

COMMIT;
