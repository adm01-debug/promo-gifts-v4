-- Migration: fix_shared_without_canonical_20260618
-- Purpose: Correct is_shared=true rows that lack canonical_image_id (data integrity fix)
-- Result: 1,146 rows corrected

BEGIN;

-- For is_shared=true rows with no canonical, find the actual root via content_hash
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
  canonical_image_id = f.root_id,
  last_modified_source = 'migration',
  updated_at = now()
FROM fixable f
WHERE pi.id = f.id;

-- For remaining is_shared=true without canonical and without a reachable root,
-- reset is_shared to false (they are effectively orphan roots)
UPDATE public.product_images
SET
  is_shared = false,
  last_modified_source = 'migration',
  updated_at = now()
WHERE deleted_at IS NULL
  AND is_shared = true
  AND canonical_image_id IS NULL;

COMMIT;
