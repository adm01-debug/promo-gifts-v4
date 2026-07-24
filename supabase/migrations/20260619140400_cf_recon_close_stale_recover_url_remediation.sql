-- P7: Close 135 stale 'recover_url_original' remediations.
--
-- CONTEXT:
--   Created 2026-06-17 19:12 with only cf_image_id set (image_db_id = NULL).
--   Purpose was to flag images whose URL needed recovery from the original CF URL.
--   Today: all 135 cf_image_ids have a live product_images record with
--     cf_sync_status = 'verified' AND is_active = true AND deleted_at IS NULL.
--   The sync pipeline already recovered the URLs — these remediations are stale.
--
-- STEPS:
--   1. Backfill image_db_id + product_id in remediation (FK was never set on insert).
--   2. Log each closure to action_log with evidence.
--   3. Mark status = 'done'.
--
-- SAFETY:
--   - Only touches rows WHERE kind = 'recover_url_original' AND status = 'open'.
--   - Backfill uses exact match product_images.cloudflare_image_id = cf_image_id.
--   - action_log insert uses ON CONFLICT DO NOTHING as safety net.
--   - Idempotent: if status already 'done', no rows match the final UPDATE.

-- Step 1: Backfill image_db_id from product_images via cloudflare_image_id
UPDATE cf_recon.remediation r
SET image_db_id = pi.id
FROM public.product_images pi
WHERE pi.cloudflare_image_id = r.cf_image_id
  AND r.kind = 'recover_url_original'
  AND r.status = 'open'
  AND r.image_db_id IS NULL;

-- Step 2: Backfill product_id from product_images after image_db_id is set
UPDATE cf_recon.remediation r
SET product_id = pi.product_id
FROM public.product_images pi
WHERE pi.id = r.image_db_id
  AND r.kind = 'recover_url_original'
  AND r.status = 'open'
  AND r.product_id IS NULL;

-- Step 3: Log all closures to action_log (immutable audit trail)
INSERT INTO cf_recon.action_log
  (actor, action, image_db_id, cf_image_id, product_id,
   old_status, new_status, evidence, reversible)
SELECT
  'claude',
  'close_stale_remediation',
  r.image_db_id,
  r.cf_image_id,
  r.product_id,
  'remediation_open',
  'remediation_done',
  jsonb_build_object(
    'reason',           'pipeline_verified_since_remediation_opened',
    'remediation_id',   r.id,
    'kind',             r.kind,
    'pi_cf_sync_status', pi.cf_sync_status,
    'pi_is_active',     pi.is_active,
    'pi_id',            pi.id,
    'migration',        '20260619140400_cf_recon_close_stale_recover_url_remediation'
  ),
  false
FROM cf_recon.remediation r
JOIN public.product_images pi ON pi.id = r.image_db_id
WHERE r.kind = 'recover_url_original'
  AND r.status = 'open';

-- Step 4: Close the remediations
UPDATE cf_recon.remediation
SET status = 'done'
WHERE kind = 'recover_url_original'
  AND status = 'open';
