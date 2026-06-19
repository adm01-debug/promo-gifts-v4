-- Migration: fix_gaps_j5_and_c6_20260619
-- Purpose: Close two gaps found in exhaustive round-3 simulation (250+ scenarios)
--
--   GAP-J5: fn_prevent_canonical_chain did NOT check if target canonical was soft-deleted.
--           Both INSERT and UPDATE paths could create dep→deleted_root (C13 violation).
--           Fix: add deleted_at check inside fn_prevent_canonical_chain; if target is
--           soft-deleted, clear canonical_image_id and is_shared before any chain logic.
--
--   GAP-C6: fn_autolink_canonical_on_content_hash "first-set" branch respected existing
--           canonical_image_id even when it pointed to a different hash group.
--           Scenario: row had NULL hash + manual canonical assigned, then hash was set
--           to a different group → row stayed in wrong canonical group, undetected.
--           Fix: in first-set branch, validate canonical's content_hash matches NEW.content_hash;
--           if mismatch → fall through to re-link to correct group.

BEGIN;

-- ══════════════════════════════════════════════════════════════════════
-- FIX GAP-J5: Enhanced canonical chain prevention
-- Also handles UPDATE path (trigger already fired; function shared by INSERT+UPDATE triggers)
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_prevent_canonical_chain()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_target_canonical uuid;
  v_target_deleted_at timestamptz;
BEGIN
  -- Fetch target's own canonical and deleted_at in a single lookup
  SELECT canonical_image_id, deleted_at
  INTO v_target_canonical, v_target_deleted_at
  FROM public.product_images
  WHERE id = NEW.canonical_image_id;

  -- GAP-J5: target is soft-deleted → clear to prevent C13 violation
  IF v_target_deleted_at IS NOT NULL THEN
    NEW.canonical_image_id := NULL;
    NEW.is_shared := false;
    RETURN NEW;
  END IF;

  -- GAP-D: target is itself a dep (non-root) → flatten to the root
  IF v_target_canonical IS NOT NULL THEN
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

-- ══════════════════════════════════════════════════════════════════════
-- FIX GAP-C6: Enhanced autolink with cross-group canonical validation
-- ══════════════════════════════════════════════════════════════════════
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
      -- Hash CHANGED (not first-set): clear old canonical so we re-link to correct group
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

COMMIT;
