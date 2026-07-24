-- P8: Fix circular reference in v_divergence.
--
-- CIRCULAR REFERENCE ROOT CAUSE (same as P5/v_cf_orphans):
--   cf_recon.cf_image was seeded by backfilling product_images WHERE
--   cf_sync_status = 'verified'. The LEFT JOIN in v_divergence matched
--   every verified row (ci.image_id IS NOT NULL), so ALL 71,938 images
--   were classified as divergence_class = 'ok' — trivially, because
--   we joined the table back onto its own source data.
--
-- FIX:
--   Add a new column: exists_in_cf_confirmed (requires crawl_run_id IS NOT NULL)
--   Update divergence_class to distinguish:
--     'ok'                          — crawl-confirmed present, db=verified
--     'ok_pending_crawl_confirmation' — backfill-only (circular), pending full crawl
--     'cf_present_db_unverified'    — confirmed present but db says unverified
--     'broken_reference_active'     — no evidence in CF, db row is active
--     'broken_reference_inactive'   — no evidence in CF, db row is inactive
--     'deleted_noise'               — no evidence in CF but row is soft-deleted (expected)
--
-- IMPACT:
--   Before fix : 71,938 rows → class 'ok' (circular)
--   After fix  :    799 rows → class 'ok' (pages 1-8 crawl-confirmed)
--               71,139 rows → class 'ok_pending_crawl_confirmation' (backfill-only)
--                   0 rows → class 'broken_*' (no images missing from cf_image)
--
--   After full crawl completes (722 pages): all ~71,938 verified images will
--   transition from 'ok_pending_crawl_confirmation' back to 'ok'.
--
-- NOTE: exists_in_cf is preserved for backwards compatibility (backfill OR crawl).
--       exists_in_cf_confirmed is the authoritative field (crawl only).

CREATE OR REPLACE VIEW cf_recon.v_divergence AS
SELECT
    pi.id                                                          AS db_id,
    pi.cloudflare_image_id,
    pi.cf_sync_status,
    pi.cf_id_scheme,
    pi.source_supplier,
    pi.is_active,
    pi.deleted_at IS NOT NULL                                      AS is_deleted,
    ci.image_id IS NOT NULL                                        AS exists_in_cf,
    CASE
        WHEN ci.image_id IS NOT NULL
             AND ci.crawl_run_id IS NOT NULL
             AND pi.cf_sync_status = 'verified'                    THEN 'ok'
        WHEN ci.image_id IS NOT NULL
             AND ci.crawl_run_id IS NULL
             AND pi.cf_sync_status = 'verified'                    THEN 'ok_pending_crawl_confirmation'
        WHEN ci.image_id IS NOT NULL
             AND pi.cf_sync_status <> 'verified'                   THEN 'cf_present_db_unverified'
        WHEN ci.image_id IS NULL
             AND pi.deleted_at IS NOT NULL                         THEN 'deleted_noise'
        WHEN ci.image_id IS NULL
             AND pi.is_active                                      THEN 'broken_reference_active'
        WHEN ci.image_id IS NULL
             AND NOT pi.is_active                                  THEN 'broken_reference_inactive'
        ELSE 'ok'
    END                                                            AS divergence_class,
    (ci.image_id IS NOT NULL AND ci.crawl_run_id IS NOT NULL)      AS exists_in_cf_confirmed
FROM public.product_images pi
LEFT JOIN cf_recon.cf_image ci
       ON ci.image_id = pi.cloudflare_image_id::text;
