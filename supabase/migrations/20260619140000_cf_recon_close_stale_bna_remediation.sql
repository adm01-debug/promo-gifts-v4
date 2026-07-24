-- P1: Close 56 stale broken_active_no_replacement remediation entries.
-- All 56 were opened on 2026-06-16 for images lacking a verified sibling.
-- The backfill pipeline subsequently re-verified all 56 cloudflare_image_ids.
-- This migration audits each closure in action_log and marks them done.

INSERT INTO cf_recon.action_log
  (actor, action, image_db_id, cf_image_id, old_status, new_status, evidence, reversible)
SELECT
  'claude',
  'close_stale_remediation',
  r.image_db_id,
  r.cf_image_id,
  'remediation_open',
  'remediation_done',
  jsonb_build_object(
    'reason',         'pipeline_verified_since_remediation',
    'remediation_id', r.id,
    'kind',           r.kind,
    'cf_id_current',  pi.cloudflare_image_id,
    'pi_updated_at',  pi.updated_at,
    'migration',      'cf_recon_20260619_close_stale_bna_remediation'
  ),
  false
FROM cf_recon.remediation r
JOIN public.product_images pi ON pi.id = r.image_db_id
WHERE r.kind = 'broken_active_no_replacement'
  AND r.status = 'open'
  AND pi.cf_sync_status = 'verified';

UPDATE cf_recon.remediation r
SET status = 'done'
FROM public.product_images pi
WHERE r.image_db_id = pi.id
  AND r.kind = 'broken_active_no_replacement'
  AND r.status = 'open'
  AND pi.cf_sync_status = 'verified';
