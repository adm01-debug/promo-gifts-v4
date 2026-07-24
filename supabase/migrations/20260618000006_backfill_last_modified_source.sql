-- Migration: backfill_last_modified_source_20260618
-- Purpose: Set NULL last_modified_source to 'pipeline' for pipeline-ingested images
-- Result: 66,794 rows updated

BEGIN;

UPDATE public.product_images
SET
  last_modified_source = 'pipeline',
  updated_at = now()
WHERE last_modified_source IS NULL
  AND deleted_at IS NULL;

COMMIT;
