-- Performance indexes para queries do backfill queue
-- Elimina memory sort em queries lentas de product_images

-- Índice para content_hash query (avg 602ms → Index Scan)
CREATE INDEX IF NOT EXISTS idx_product_images_content_hash_orderby
ON public.product_images (is_primary DESC, id ASC)
WHERE content_hash IS NULL
  AND cf_sync_status = 'verified'
  AND deleted_at IS NULL;

-- Índice para width_px (dimensions) query (avg 230ms)
CREATE INDEX IF NOT EXISTS idx_product_images_missing_dimensions_orderby
ON public.product_images (is_primary DESC, created_at ASC, id)
WHERE width_px IS NULL
  AND is_active = true
  AND format IS NOT NULL;
