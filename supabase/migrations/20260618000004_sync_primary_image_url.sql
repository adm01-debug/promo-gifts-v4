-- Migration: sync_primary_image_url_desync_20260618
-- Purpose: Re-sync products.primary_image_url where it diverges from product_images primary
-- Result: 1 product corrected

BEGIN;

UPDATE public.products p
SET
  primary_image_url = pi.url_cdn,
  updated_at = now()
FROM public.product_images pi
WHERE pi.product_id = p.id
  AND pi.is_primary = true
  AND pi.is_active = true
  AND pi.deleted_at IS NULL
  AND p.is_active = true
  AND (p.is_deleted IS NULL OR p.is_deleted = false)
  AND p.primary_image_url IS NOT NULL
  AND p.primary_image_url <> pi.url_cdn;

COMMIT;
