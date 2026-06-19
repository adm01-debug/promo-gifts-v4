-- Migration: fix_gap_c5_embed_relink_20260619
-- Purpose: Fix the GAP-C5 implementation from migration 006.
--
-- Problem discovered: trg_relink_former_deps_on_root_becomes_dep fires on
-- AFTER UPDATE OF canonical_image_id. However, PostgreSQL column-specific AFTER
-- triggers only fire when the column appears in the original UPDATE SET list.
-- Since fn_autolink_canonical_on_content_hash modifies NEW.canonical_image_id
-- inside a BEFORE trigger (not via the caller's SET list), the AFTER trigger
-- never fired for the root→dep transition caused by hash changes.
--
-- Fix: Drop the non-functional AFTER trigger and embed the former-dep re-linking
-- directly inside fn_autolink_canonical_on_content_hash. When a root becomes a
-- dep (OLD.canonical_image_id IS NULL and we found v_root_id), issue an UPDATE
-- on all former deps before returning NEW.

BEGIN;

-- Drop the non-functional AFTER trigger
DROP TRIGGER IF EXISTS trg_relink_former_deps_on_root_becomes_dep ON public.product_images;
DROP FUNCTION IF EXISTS public.fn_relink_former_deps_on_root_becomes_dep();

-- Replace fn_autolink_canonical_on_content_hash with embedded GAP-C5 fix
CREATE OR REPLACE FUNCTION public.fn_autolink_canonical_on_content_hash()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_root_id uuid;
  v_existing_canonical_hash text;
BEGIN
  -- Only act when content_hash is being set or changed
  IF NEW.content_hash IS NULL OR (OLD.content_hash IS NOT NULL AND OLD.content_hash = NEW.content_hash) THEN
    RETURN NEW;
  END IF;

  -- If image already has a canonical assignment:
  IF NEW.canonical_image_id IS NOT NULL THEN
    IF OLD.content_hash IS NOT NULL AND OLD.content_hash IS DISTINCT FROM NEW.content_hash THEN
      -- Hash CHANGED (not first-set): clear old canonical so we can re-link to correct group
      NEW.canonical_image_id := NULL;
      NEW.is_shared := false;
      -- Fall through to find new root for new hash
    ELSE
      -- First-set (OLD.content_hash was NULL): validate canonical belongs to SAME hash group
      -- GAP-C6: existing canonical may point to a different-hash group
      SELECT content_hash INTO v_existing_canonical_hash
      FROM public.product_images
      WHERE id = NEW.canonical_image_id;

      IF v_existing_canonical_hash IS NOT DISTINCT FROM NEW.content_hash THEN
        -- Same hash group: respect existing canonical
        RETURN NEW;
      END IF;
      -- Wrong hash group: fall through to re-link to correct root
      NEW.canonical_image_id := NULL;
      NEW.is_shared := false;
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

    -- GAP-C5: If THIS row was previously a root (OLD.canonical_image_id IS NULL),
    -- re-link its former deps to the new root so no dep→dep chains remain.
    -- This must happen here (BEFORE trigger DML) because an AFTER trigger on
    -- canonical_image_id does not fire when BEFORE triggers modify that column.
    IF OLD.canonical_image_id IS NULL THEN
      UPDATE public.product_images
      SET canonical_image_id = v_root_id,
          updated_at          = now()
      WHERE canonical_image_id = NEW.id
        AND id <> NEW.id
        AND deleted_at IS NULL;
    END IF;
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

      -- GAP-C5 fallback path: same re-linking needed
      IF OLD.canonical_image_id IS NULL THEN
        UPDATE public.product_images
        SET canonical_image_id = v_root_id,
            updated_at          = now()
        WHERE canonical_image_id = NEW.id
          AND id <> NEW.id
          AND deleted_at IS NULL;
      END IF;
    END IF;
    -- If only member → remain as standalone root (no re-linking needed)
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_autolink_canonical_on_content_hash() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_autolink_canonical_on_content_hash() TO service_role;

COMMIT;
