-- P9: Enrich v_health_dashboard with crawl-layer metrics.
--
-- PROBLEM:
--   cf_crawled = COUNT(*) FROM cf_recon.cf_image counts all 72,079 rows,
--   including 71,280 backfill rows (crawl_run_id IS NULL). The metric name
--   implies "images confirmed by crawl" but the reality is "rows in table".
--   Also, the new divergence classes from P8 (ok / ok_pending_crawl_confirmation)
--   are not represented in the dashboard at all.
--
-- FIX:
--   Append 5 new columns after the existing 10 (CREATE OR REPLACE VIEW cannot
--   reorder or rename existing columns):
--     cf_backfill_only        — rows seeded from DB (crawl_run_id IS NULL)
--     cf_crawl_confirmed      — rows confirmed by real CF API crawl
--     divergence_ok           — images fully verified by crawl
--     divergence_pending      — images verified by DB but not yet by crawl
--     divergence_broken       — images with no CF evidence at all (needs action)
--
--   The existing cf_crawled column is preserved for backwards compatibility
--   (it continues to count total cf_image rows).
--
-- POST FULL CRAWL EXPECTATION:
--   cf_backfill_only → 0 (all rows get crawl_run_id after full crawl)
--   cf_crawl_confirmed → ~72,199 (total CF images)
--   divergence_ok → ~71,938 (all active verified images)
--   divergence_pending → 0

CREATE OR REPLACE VIEW cf_recon.v_health_dashboard AS
SELECT
    (SELECT COUNT(*) FROM public.product_images)                               AS db_total,
    (SELECT COUNT(*) FROM public.product_images WHERE is_active)               AS db_active,
    (SELECT COUNT(*) FROM public.product_images WHERE cf_sync_status = 'verified') AS verified,
    (SELECT COUNT(*) FROM public.product_images WHERE cf_sync_status = 'pending')  AS pending,
    (SELECT COUNT(*) FROM public.product_images WHERE cf_sync_status = 'missing')  AS missing,
    (SELECT COUNT(*) FROM public.product_images
     WHERE cf_sync_status = 'missing' AND is_active)                           AS missing_active,
    (SELECT COUNT(*) FROM cf_recon.v_verification_queue)                       AS queue_real,
    (SELECT COUNT(*) FROM cf_recon.remediation WHERE status = 'open')          AS remediation_open,
    (SELECT COUNT(*) FROM cf_recon.cf_image)                                   AS cf_crawled,
    (SELECT COUNT(*) FROM cf_recon.action_log)                                 AS actions_logged,
    -- New crawl-layer metrics (P9)
    (SELECT COUNT(*) FROM cf_recon.cf_image WHERE crawl_run_id IS NULL)        AS cf_backfill_only,
    (SELECT COUNT(*) FROM cf_recon.cf_image WHERE crawl_run_id IS NOT NULL)    AS cf_crawl_confirmed,
    (SELECT COUNT(*) FROM cf_recon.v_divergence
     WHERE divergence_class = 'ok')                                            AS divergence_ok,
    (SELECT COUNT(*) FROM cf_recon.v_divergence
     WHERE divergence_class = 'ok_pending_crawl_confirmation')                 AS divergence_pending,
    (SELECT COUNT(*) FROM cf_recon.v_divergence
     WHERE divergence_class LIKE 'broken%')                                    AS divergence_broken;
