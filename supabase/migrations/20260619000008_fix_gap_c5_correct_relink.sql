-- Migration: fix_gap_c5_correct_relink_20260619
-- Purpose: Correct the GAP-C5 re-linking logic from migration 007.
--
-- Problem discovered: When rootA (hash=VFY2) changes to VFY3 and becomes a dep of rootB,
-- migration 007 re-linked all former deps (dep1, dep2, both hash=VFY2) to rootB (hash=VFY3).
-- This created C16 violations: dep.content_hash ≠ canonical.content_hash.
--
-- Correct approach: former deps must be re-grouped by THEIR OWN content_hash.
--   Case A — another live root exists for OLD.content_hash: link all former deps to it.
--   Case B — no other root for OLD.content_hash: elect oldest former dep as new root,
--            re-link remaining former deps to the newly elected root.
--
-- Note: If some deps were manually cross-linked (different hash than rootA), they become
-- standalone roots; C16 would catch any residual violations in the next health check.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_autolink_canonical_on_content_hash()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_root_id               uuid;
  v_existing_canonical_hash text;
  v_old_group_root        uuid;
  v_elected_dep_root      uuid;
BEGIN
  -- Only act when content_hash is being set or changed
  IF NEW.content_hash IS NULL OR (OLD.content_hash IS NOT NULL AND OLD.content_hash = NEW.content_hash) THEN
    RETURN NEW;
  END IF;

  -- If image already has a canonical assignment:
  IF NEW.canonical_image_id IS NOT NULL THEN
    IF OLD.content_hash IS NOT NULL AND OLD.content_hash IS DISTINCT FROM NEW.content_hash THEN
      -- Hash CHANGED (not first-set): clear old canonical → re-link to correct group
      NEW.canonical_image_id := NULL;
      NEW.is_shared := false;
    ELSE
      -- First-set (OLD.content_hash was NULL): validate canonical belongs to SAME hash group
      -- GAP-C6: existing canonical may point to a different-hash group
      SELECT content_hash INTO v_existing_canonical_hash
      FROM public.product_images
      WHERE id = NEW.canonical_image_id;

      IF v_existing_canonical_hash IS NOT DISTINCT FROM NEW.content_hash THEN
        RETURN NEW;  -- Same hash group: respect existing canonical
      END IF;
      -- Wrong hash group: fall through to re-link to correct root
      NEW.canonical_image_id := NULL;
      NEW.is_shared := false;
    END IF;
  END IF;

  -- Find the oldest root in the new hash group
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

  -- ══════════════════════════════════════════════════════════════
  -- GAP-C5: This row WAS a root (OLD.canonical_image_id IS NULL)
  -- and has now been assigned to a new hash group.
  -- Former deps (rows that still point to NEW.id) need to be
  -- re-grouped by THEIR OWN content_hash — not blindly moved to
  -- the new root, since their content may differ from NEW.content_hash.
  --
  -- MUST run as BEFORE trigger DML: AFTER trigger on canonical_image_id
  -- does not fire when BEFORE triggers are responsible for the change.
  -- ══════════════════════════════════════════════════════════════
  IF OLD.canonical_image_id IS NULL AND v_root_id IS NOT NULL THEN

    -- Case A: Is there another live root for OLD.content_hash?
    -- (Excluding NEW.id which is leaving that hash group)
    SELECT id INTO v_old_group_root
    FROM public.product_images
    WHERE content_hash = OLD.content_hash
      AND deleted_at IS NULL
      AND canonical_image_id IS NULL
      AND id <> NEW.id
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    IF v_old_group_root IS NOT NULL THEN
      -- Link all former deps to the surviving root of OLD.content_hash group
      UPDATE public.product_images
      SET canonical_image_id = v_old_group_root,
          is_shared           = true,
          updated_at          = now()
      WHERE canonical_image_id = NEW.id
        AND id <> NEW.id
        AND deleted_at IS NULL;

    ELSE
      -- Case B: No other root for OLD.content_hash — elect oldest former dep as new root

      SELECT id INTO v_elected_dep_root
      FROM public.product_images
      WHERE canonical_image_id = NEW.id
        AND id <> NEW.id
        AND deleted_at IS NULL
      ORDER BY created_at ASC, id ASC
      LIMIT 1;

      IF v_elected_dep_root IS NOT NULL THEN
        -- Promote elected dep to standalone root
        UPDATE public.product_images
        SET canonical_image_id = NULL,
            is_shared           = false,
            updated_at          = now()
        WHERE id = v_elected_dep_root;

        -- Link all remaining former deps to the elected root
        -- (Rows with different content_hash from elected_dep become orphaned standalones
        --  in this step; C16 will detect any residual cross-group violations.)
        UPDATE public.product_images
        SET canonical_image_id = v_elected_dep_root,
            is_shared           = true,
            updated_at          = now()
        WHERE canonical_image_id = NEW.id
          AND id <> NEW.id
          AND id <> v_elected_dep_root
          AND deleted_at IS NULL;
      END IF;
      -- If no former deps → nothing to do
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_autolink_canonical_on_content_hash() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_autolink_canonical_on_content_hash() TO service_role;

COMMIT;
