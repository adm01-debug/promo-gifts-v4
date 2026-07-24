-- Migration: P2.8 — blurhash population via Edge Function cron
-- Applied: 2026-06-17
-- Session: https://claude.ai/code/session_015AMvYV8EoNtNpvL7jrUm83
--
-- Registers a pg_cron job that calls the `generate-blurhashes` Edge Function
-- every 5 minutes. The function downloads each verified JPEG/PNG image, decodes
-- pixels, resizes to 32×32, and encodes a blurhash string stored in
-- product_images.blurhash. Skips WebP/GIF (unsupported pure-JS decoders).
--
-- Prerequisite: vault secret 'GENERATE_BLURHASHES_CRON_SECRET' must be set.
-- Coverage: ~67,344 images (JPEG 54,866 + PNG 12,478 = 93.4% of verified).
-- Throughput: ~480 hashes/hour (40 images × 12 invocations).
-- ETA to full JPEG+PNG coverage: ~140 hours from first run.
--
-- To monitor progress:
--   SELECT COUNT(*) FROM product_images
--   WHERE blurhash IS NULL AND cf_sync_status = 'verified'
--     AND deleted_at IS NULL AND format IN ('jpeg', 'png');

-- ─── Index for efficient next-batch selection ─────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_product_images_blurhash_null
  ON product_images (is_primary DESC, id)
  WHERE blurhash IS NULL
    AND cf_sync_status = 'verified'
    AND deleted_at IS NULL
    AND format IN ('jpeg', 'png');

-- ─── pg_cron job ──────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-blurhashes') THEN
    PERFORM cron.unschedule('generate-blurhashes');
  END IF;
END $$;

SELECT cron.schedule(
  'generate-blurhashes',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := public.get_edge_functions_base_url() || '/functions/v1/generate-blurhashes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.get_edge_function_secret('GENERATE_BLURHASHES_CRON_SECRET')
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 55000
  ) AS request_id;
  $cron$
);
