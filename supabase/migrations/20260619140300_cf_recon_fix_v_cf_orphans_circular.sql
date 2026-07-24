-- P5: Fix v_cf_orphans circular reference; close partial CF API crawl record.
--
-- CIRCULAR REFERENCE ROOT CAUSE:
--   cf_recon.cf_image was populated by backfilling from
--   product_images WHERE cf_sync_status = 'verified'.
--   Since every cf_image row came FROM product_images, the LEFT JOIN
--   always matched, so v_cf_orphans always returned 0 rows.
--
-- FIX:
--   Add crawl_run_id IS NOT NULL to v_cf_orphans so only images
--   confirmed by a real Cloudflare API crawl are considered.
--   Backfill rows (crawl_run_id = NULL) are excluded — they are
--   circular by construction and cannot detect true orphans.
--
-- CRAWL STATUS (2026-06-19):
--   crawl_run bf9095c3-34c7-49a1-b9be-fd1925a78145
--   Pages 1–8 = 800 real images confirmed.  0 orphans found.
--   Full crawl (722 pages, ~72 199 images) pending via scheduled job.

CREATE OR REPLACE VIEW cf_recon.v_cf_orphans AS
SELECT ci.image_id,
    ci.uploaded_at,
    ci.filename
   FROM cf_recon.cf_image ci
     LEFT JOIN public.product_images pi ON (pi.cloudflare_image_id)::text = ci.image_id
  WHERE pi.id IS NULL
    AND ci.crawl_run_id IS NOT NULL;

-- Close the partial crawl run (idempotent)
UPDATE cf_recon.crawl_run
SET
  pages_scanned = 8,
  images_seen   = 800,
  status        = 'partial',
  finished_at   = COALESCE(finished_at, NOW()),
  notes         = 'Partial crawl 2026-06-19: pages 1-8 (800 images). '
               || 'Full crawl pending (722 total pages, ~72199 images). '
               || 'Breaks circular reference: cf_image was seeded from DB-verified records; '
               || 'this crawl seeds real CF metadata with crawl_run_id so v_cf_orphans '
               || 'filters to confirmed-real data only.'
WHERE id = 'bf9095c3-34c7-49a1-b9be-fd1925a78145'
  AND status IN ('running', 'partial');
