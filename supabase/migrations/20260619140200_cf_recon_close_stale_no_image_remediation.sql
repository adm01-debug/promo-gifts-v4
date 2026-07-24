-- P4: Close 5 product_no_active_image remediation entries.
-- All 5 products are now is_active=false — deactivated since the remediation was opened.
-- A product with no image AND no active status is no longer a live business issue.

INSERT INTO cf_recon.action_log
  (actor, action, image_db_id, cf_image_id, old_status, new_status, product_id, evidence, reversible)
SELECT
  'claude',
  'close_stale_remediation',
  NULL,
  NULL,
  'remediation_open',
  'remediation_done',
  r.product_id,
  jsonb_build_object(
    'reason',         'product_deactivated_since_remediation_opened',
    'remediation_id', r.id,
    'kind',           r.kind,
    'product_name',   p.name,
    'product_active', p.is_active,
    'migration',      'cf_recon_20260619_close_stale_no_image_remediation'
  ),
  false
FROM cf_recon.remediation r
JOIN public.products p ON p.id = r.product_id
WHERE r.kind = 'product_no_active_image'
  AND r.status = 'open'
  AND p.is_active = false;

UPDATE cf_recon.remediation r
SET status = 'done'
FROM public.products p
WHERE r.product_id = p.id
  AND r.kind = 'product_no_active_image'
  AND r.status = 'open'
  AND p.is_active = false;
