-- Migration: P2.9b — fix backfill-image-dimensions cron to include x-cron-secret
-- Applied: 2026-06-17
--
-- The original cron registration (migration 20260616003458) sent no auth header:
--   headers := '{"Content-Type":"application/json"}'::jsonb
--
-- Since authorizeCron requires x-cron-secret to be present (fail-closed SEC-003),
-- every invocation returned 401 — the cron was effectively a no-op.
--
-- This migration re-registers the cron with:
--   1. Dynamic URL via get_edge_functions_base_url() (avoids hardcoded project ID)
--   2. x-cron-secret header read from vault via get_edge_function_secret()
--   3. 55s timeout (same as hash-product-images / generate-blurhashes)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'backfill-image-dimensions') THEN
    PERFORM cron.unschedule('backfill-image-dimensions');
  END IF;
END $$;

SELECT cron.schedule(
  'backfill-image-dimensions',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := public.get_edge_functions_base_url() || '/functions/v1/backfill-image-dimensions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.get_edge_function_secret('BACKFILL_DIM_CRON_SECRET')
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 55000
  ) AS request_id;
  $cron$
);
