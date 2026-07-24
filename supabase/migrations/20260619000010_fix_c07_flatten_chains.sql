-- Migration: fix_c07_flatten_chains_20260619
-- Purpose: Repair 3 pre-existing C07 chain violations (dep→dep→root) in production data.
--
-- Root cause: 3 rows created on 2026-06-16 (before trigger migrations 003-009 were applied)
-- point their canonical_image_id to a non-root (an intermediate dep), creating chains.
-- The trigger system now PREVENTS new chains, but does not retroactively fix old ones.
--
-- Structure of each violation (depth-2 chain):
--   leaf.canonical_image_id → mid (mid has canonical_image_id IS NOT NULL → also a dep)
--   mid.canonical_image_id  → root (root has canonical_image_id IS NULL)
--
-- Fix: UPDATE leaf.canonical_image_id = root directly (flatten the chain).
-- The BEFORE trigger fn_prevent_canonical_chain will pass because the new target IS a root.
-- The BEFORE trigger fn_autolink_canonical_on_content_hash returns early because content_hash
-- is unchanged (OLD.content_hash = NEW.content_hash → early exit).
--
-- Chains:
--   1. abda0161 → 841a72aa → 6ca5eddb  (hash a8377af3...)
--   2. eab69176 → 8ba37b00 → 4cccd0e1  (hash 5aabff12...)
--   3. 0004ae2c → c34c6b6e → 22d82e57  (hash 6b0213e5...)

-- ── Repair: flatten chain 1 ────────────────────────────────────────────────────
UPDATE public.product_images
SET canonical_image_id   = '6ca5eddb-d923-401f-83bd-4a1b45b6391b',
    last_modified_source = 'migration',
    updated_at           = now()
WHERE id = 'abda0161-ae08-4212-a1fc-47a395afa3cf';

-- ── Repair: flatten chain 2 ────────────────────────────────────────────────────
UPDATE public.product_images
SET canonical_image_id   = '4cccd0e1-2676-4311-bbc2-c6edfe0f3fc8',
    last_modified_source = 'migration',
    updated_at           = now()
WHERE id = 'eab69176-0a91-4251-87b4-c5d3466a5813';

-- ── Repair: flatten chain 3 ────────────────────────────────────────────────────
UPDATE public.product_images
SET canonical_image_id   = '22d82e57-bf18-48d6-bcf7-e4a29c4047df',
    last_modified_source = 'migration',
    updated_at           = now()
WHERE id = '0004ae2c-278c-4937-a983-51798cd7210d';

-- ── Utility: general-purpose chain repair function ─────────────────────────────
-- Finds all depth-N chains and flattens them to depth-1 (direct dep→root).
-- Uses a loop with a max depth guard to handle arbitrary chain lengths.
-- Safe to call multiple times (idempotent).

CREATE OR REPLACE FUNCTION public.fn_repair_canonical_chains(p_max_iterations int DEFAULT 10)
RETURNS TABLE(iterations_run int, chains_repaired bigint)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_iteration  int := 0;
  v_repaired   bigint;
  v_total      bigint := 0;
BEGIN
  LOOP
    v_iteration := v_iteration + 1;
    EXIT WHEN v_iteration > p_max_iterations;

    -- One pass: find deps whose canonical points to a non-root; update to root
    WITH chains AS (
      SELECT
        child.id                         AS child_id,
        mid.canonical_image_id           AS true_root_id
      FROM public.product_images child
      JOIN public.product_images mid ON mid.id = child.canonical_image_id
      WHERE child.canonical_image_id IS NOT NULL
        AND mid.canonical_image_id IS NOT NULL
        AND child.deleted_at IS NULL
      LIMIT 10000
    )
    UPDATE public.product_images pi
    SET canonical_image_id   = c.true_root_id,
        last_modified_source = 'migration',
        updated_at           = now()
    FROM chains c
    WHERE pi.id = c.child_id;

    GET DIAGNOSTICS v_repaired = ROW_COUNT;
    v_total := v_total + v_repaired;

    EXIT WHEN v_repaired = 0;
  END LOOP;

  RETURN QUERY SELECT v_iteration, v_total;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_repair_canonical_chains(int) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_repair_canonical_chains(int) TO service_role;

-- ── Self-test: verify C07 = 0 after repair ─────────────────────────────────────
DO $$
DECLARE v_chains bigint;
BEGIN
  SELECT COUNT(*) INTO v_chains
  FROM public.product_images pi_child
  JOIN public.product_images pi_root ON pi_root.id = pi_child.canonical_image_id
  WHERE pi_child.canonical_image_id IS NOT NULL
    AND pi_root.canonical_image_id IS NOT NULL;

  IF v_chains <> 0 THEN
    RAISE EXCEPTION 'post-repair C07 assertion failed: % chains remain', v_chains;
  END IF;
END;
$$;
