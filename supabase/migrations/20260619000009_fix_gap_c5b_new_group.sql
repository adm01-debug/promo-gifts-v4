-- Migration: fix_gap_c5b_new_group_20260619
-- Purpose: Extend GAP-C5 re-linking to cover the case where a root changes hash
--          to a BRAND NEW group (one with no existing members).
--
-- Problem discovered (GAP-C5b): Migration 008 only fired the former-dep re-link block
-- when v_root_id IS NOT NULL (i.e., the root joined an existing group and became a dep).
-- When a root changes hash to a new group with no existing members, v_root_id stays NULL,
-- the C5 block is skipped, and former deps remain pointing to the root with a mismatched
-- content_hash — creating C16 violations (dep.content_hash ≠ canonical.content_hash).
--
-- Example:
--   rootA(VFY2) + dep1(VFY2) + dep2(VFY2)
--   rootA changes hash → VFY9 (brand new group)
--   rootA stays standalone root of VFY9.
--   dep1 and dep2 still point to rootA but have VFY2 hash → C16 violations.
--
-- Fix: Change the C5 trigger condition from
--   OLD.canonical_image_id IS NULL AND v_root_id IS NOT NULL
-- to
--   OLD.canonical_image_id IS NULL AND OLD.content_hash IS NOT NULL
--
-- This fires whenever the row WAS a root in a previous hash group (OLD.content_hash IS NOT NULL),
-- regardless of whether it joins a new group (v_root_id IS NOT NULL) or remains standalone.
-- Using OLD.content_hash IS NOT NULL avoids edge cases where the hash was NULL (first-set),
-- where deps would have NULL hash and no C16 violation exists.

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
  -- GAP-C5 / GAP-C5b: This row WAS a root (OLD.canonical_image_id IS NULL)
  -- in a previous hash group (OLD.content_hash IS NOT NULL).
  -- Former deps (rows that still point to NEW.id) need to be
  -- re-grouped by THEIR OWN content_hash — regardless of whether
  -- this row joined an existing group (v_root_id IS NOT NULL) or
  -- became a standalone root in a new group (v_root_id IS NULL).
  --
  -- Condition changed from migration 008:
  --   OLD: IF OLD.canonical_image_id IS NULL AND v_root_id IS NOT NULL
  --   NEW: IF OLD.canonical_image_id IS NULL AND OLD.content_hash IS NOT NULL
  --
  -- Using OLD.content_hash IS NOT NULL guards against first-set (NULL→hash)
  -- where former NULL-hash deps cannot be found via content_hash equality.
  -- ══════════════════════════════════════════════════════════════
  IF OLD.canonical_image_id IS NULL AND OLD.content_hash IS NOT NULL THEN

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
        -- (Deps with different content_hash than elected_dep will be caught by C16)
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
