-- ============================================================================
-- E2-L1: Backfill format via regex em url_original (20.116 imagens)
-- jpg → jpeg (normalização canônica), webp → webp, etc.
-- O trigger trg_normalize_image_format (BEFORE UPDATE OF format) reprocessa
-- o valor mas já enviamos a forma canônica → no-op seguro.
-- ============================================================================
UPDATE public.product_images
SET format = CASE
  WHEN lower(substring(url_original from '\.([a-zA-Z0-9]+)(\?.*)?$')) = 'jpg'  THEN 'jpeg'
  WHEN lower(substring(url_original from '\.([a-zA-Z0-9]+)(\?.*)?$')) = 'jpeg' THEN 'jpeg'
  WHEN lower(substring(url_original from '\.([a-zA-Z0-9]+)(\?.*)?$')) = 'png'  THEN 'png'
  WHEN lower(substring(url_original from '\.([a-zA-Z0-9]+)(\?.*)?$')) = 'webp' THEN 'webp'
  WHEN lower(substring(url_original from '\.([a-zA-Z0-9]+)(\?.*)?$')) = 'gif'  THEN 'gif'
  WHEN lower(substring(url_original from '\.([a-zA-Z0-9]+)(\?.*)?$')) = 'avif' THEN 'avif'
  ELSE lower(substring(url_original from '\.([a-zA-Z0-9]+)(\?.*)?$'))
END
WHERE format IS NULL
  AND url_original IS NOT NULL AND url_original <> ''
  AND url_original ~ '\.[a-zA-Z0-9]{2,5}(\?.*)?$'
  AND lower(substring(url_original from '\.([a-zA-Z0-9]+)(\?.*)?$'))
      IN ('jpg','jpeg','png','webp','gif','avif','bmp','tiff','svg');
