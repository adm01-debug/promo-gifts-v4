-- Migration: flatten_canonical_chains_20260618 + fix_shared_null_after_flatten_20260618
-- Purpose: Flatten any A→B→C canonical chains to A→C (all deps point directly to root)
-- Then fix CTE artefact where final_root_id resolved to NULL for true roots
-- Result: 65 chains flattened; 65 CTE artefacts corrected via 3-step fix

BEGIN;

-- Step 1: Flatten chains — update deps that point to a non-root to point to the true root
UPDATE public.product_images pi_dep
SET
  canonical_image_id  = pi_root.id,
  last_modified_source = 'migration',
  updated_at          = now()
FROM public.product_images pi_mid
JOIN public.product_images pi_root ON pi_root.id = pi_mid.canonical_image_id
WHERE pi_dep.canonical_image_id = pi_mid.id
  AND pi_mid.canonical_image_id IS NOT NULL  -- pi_mid is itself a dep, not a root
  AND pi_root.canonical_image_id IS NULL     -- pi_root is a true root
  AND pi_dep.deleted_at IS NULL;

-- Step 2 (CTE artefact fix — 3 sub-steps):

-- 2a: Relink is_shared=true / canonical=NULL to root via content_hash (where root exists)
WITH fixable AS (
  SELECT pi.id, g.root_id
  FROM public.product_images pi
  JOIN (
    SELECT content_hash, MIN(id ORDER BY created_at ASC, id ASC) AS root_id
    FROM public.product_images
    WHERE content_hash IS NOT NULL
      AND deleted_at IS NULL
      AND is_shared = false
      AND canonical_image_id IS NULL
    GROUP BY content_hash
  ) g ON g.content_hash = pi.content_hash
  WHERE pi.deleted_at IS NULL
    AND pi.is_shared = true
    AND pi.canonical_image_id IS NULL
    AND pi.id <> g.root_id
)
UPDATE public.product_images pi
SET
  canonical_image_id  = f.root_id,
  last_modified_source = 'migration',
  updated_at          = now()
FROM fixable f
WHERE pi.id = f.id;

-- 2b: For content_hash groups where ALL members lost their canonical (all zeroed by CTE bug),
--     elect the oldest as root and relink the rest
WITH orphan_groups AS (
  SELECT content_hash
  FROM public.product_images
  WHERE deleted_at IS NULL
    AND is_shared = true
    AND canonical_image_id IS NULL
    AND content_hash IS NOT NULL
  GROUP BY content_hash
),
roots AS (
  SELECT DISTINCT ON (og.content_hash) pi.id AS root_id, og.content_hash
  FROM orphan_groups og
  JOIN public.product_images pi ON pi.content_hash = og.content_hash AND pi.deleted_at IS NULL
  ORDER BY og.content_hash, pi.created_at ASC, pi.id ASC
)
-- Promote oldest member to non-shared root
UPDATE public.product_images pi
SET
  is_shared           = false,
  canonical_image_id  = NULL,
  last_modified_source = 'migration',
  updated_at          = now()
FROM roots r
WHERE pi.id = r.root_id;

-- 2c: Relink remaining is_shared=true / canonical=NULL to the newly elected roots
WITH newly_fixed AS (
  SELECT pi.id, g.root_id
  FROM public.product_images pi
  JOIN (
    SELECT content_hash, id AS root_id
    FROM public.product_images
    WHERE deleted_at IS NULL
      AND is_shared = false
      AND canonical_image_id IS NULL
      AND content_hash IS NOT NULL
  ) g ON g.content_hash = pi.content_hash
  WHERE pi.deleted_at IS NULL
    AND pi.is_shared = true
    AND pi.canonical_image_id IS NULL
    AND pi.id <> g.root_id
)
UPDATE public.product_images pi
SET
  canonical_image_id  = f.root_id,
  last_modified_source = 'migration',
  updated_at          = now()
FROM newly_fixed f
WHERE pi.id = f.id;

COMMIT;
