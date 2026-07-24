-- Migration: link_unlinked_content_hash_dupes_20260618
-- Purpose: Link duplicate images by content_hash into canonical groups (flat chains)
-- Result: 2,485 dependents linked across 1,621 groups

BEGIN;

-- Link images that share content_hash but have no canonical assignment yet.
-- The oldest image (by created_at) in each group becomes the canonical root.
WITH groups AS (
  SELECT
    content_hash,
    MIN(id ORDER BY created_at ASC, id ASC) AS root_id,
    array_agg(id ORDER BY created_at ASC, id ASC) AS all_ids
  FROM public.product_images
  WHERE content_hash IS NOT NULL
    AND deleted_at IS NULL
    AND canonical_image_id IS NULL
  GROUP BY content_hash
  HAVING COUNT(*) > 1
),
deps AS (
  SELECT g.root_id, pi.id AS dep_id
  FROM groups g
  JOIN public.product_images pi ON pi.content_hash = g.content_hash
    AND pi.deleted_at IS NULL
    AND pi.canonical_image_id IS NULL
    AND pi.id <> g.root_id
)
UPDATE public.product_images pi
SET
  canonical_image_id = d.root_id,
  is_shared = true,
  last_modified_source = 'migration',
  updated_at = now()
FROM deps d
WHERE pi.id = d.dep_id;

COMMIT;
