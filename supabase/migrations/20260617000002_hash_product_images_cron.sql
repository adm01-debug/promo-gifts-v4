-- Migration: P2.7 — content_hash population via Edge Function cron
-- Applied: 2026-06-17
-- Session: https://claude.ai/code/session_015AMvYV8EoNtNpvL7jrUm83
--
-- Registers a pg_cron job that calls the `hash-product-images` Edge Function
-- every 5 minutes. The function downloads each verified image and computes
-- a SHA-256 hex digest stored in product_images.content_hash.
--
-- Prerequisite: vault secret 'HASH_PRODUCT_IMAGES_CRON_SECRET' must be set.
-- Set it via: Supabase dashboard → Settings → Vault → New Secret
-- Match the value to HASH_PRODUCT_IMAGES_CRON_SECRET in Edge Function env.
--
-- Throughput: ~960 hashes/hour (80 images × 12 invocations).
-- ETA to full coverage: ~75 hours from first run (72,047 verified images).
--
-- To monitor progress:
--   SELECT COUNT(*) FROM product_images
--   WHERE content_hash IS NULL AND cf_sync_status = 'verified' AND deleted_at IS NULL;

-- ─── Index for efficient next-batch selection ─────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_product_images_content_hash_null
  ON product_images (id)
  WHERE content_hash IS NULL
    AND cf_sync_status = 'verified'
    AND deleted_at IS NULL;

-- ─── pg_cron job ──────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hash-product-images') THEN
    PERFORM cron.unschedule('hash-product-images');
  END IF;
END $$;

SELECT cron.schedule(
  'hash-product-images',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := public.get_edge_functions_base_url() || '/functions/v1/hash-product-images',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.get_edge_function_secret('HASH_PRODUCT_IMAGES_CRON_SECRET')
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 55000
  ) AS request_id;
  $cron$
);

-- ─── Duplicate detection view (available once hashes start populating) ────────
-- Finds images with identical pixel content stored under different CF IDs.
-- Useful for deduplication audits after content_hash is fully populated.

CREATE OR REPLACE VIEW public.v_product_image_hash_duplicates AS
SELECT
  content_hash,
  COUNT(*)                                              AS duplicate_count,
  array_agg(cloudflare_image_id ORDER BY cloudflare_image_id) AS cf_ids,
  array_agg(id ORDER BY cloudflare_image_id)           AS image_ids,
  MIN(created_at)                                      AS oldest_upload
FROM product_images
WHERE content_hash IS NOT NULL
  AND deleted_at IS NULL
GROUP BY content_hash
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, content_hash;

COMMENT ON VIEW public.v_product_image_hash_duplicates IS
  'Images with identical SHA-256 content_hash stored under different cloudflare_image_ids. '
  'Populated once hash-product-images cron has run. Use for deduplication audits.';
