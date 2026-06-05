
-- ════════════════════════════════════════════════════════════════
-- Fix: images_status consistency — raw rows that point to products
-- which already have images in product_images should be marked as
-- images_status='processed'. The image pipeline ran but forgot to
-- update the flag. Safe backfill: only touches rows where
-- status='processed' AND images_status='pending' AND product has images.
-- ════════════════════════════════════════════════════════════════

UPDATE public.supplier_products_raw spr
SET images_status = 'processed'
WHERE spr.status = 'processed'
  AND spr.images_status = 'pending'
  AND spr.product_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.product_images pi
    WHERE pi.product_id = spr.product_id
  );
