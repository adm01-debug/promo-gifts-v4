-- P2: Add product_id to action_log for cascade-delete resilience.
-- When a product is physically deleted, product_images rows cascade-delete,
-- making action_log.image_db_id orphaned with no product traceability.
-- Storing product_id directly survives the cascade.

ALTER TABLE cf_recon.action_log
  ADD COLUMN IF NOT EXISTS product_id uuid;

COMMENT ON COLUMN cf_recon.action_log.product_id IS
  'Denormalized product_id for cascade-delete resilience. '
  'Null for legacy rows where product_images was already cascade-deleted.';

-- Backfill from live product_images rows
UPDATE cf_recon.action_log al
SET product_id = pi.product_id
FROM public.product_images pi
WHERE pi.id = al.image_db_id
  AND al.product_id IS NULL;

-- Backfill remaining from remediation table (idempotent)
UPDATE cf_recon.action_log al
SET product_id = r.product_id
FROM cf_recon.remediation r
WHERE r.image_db_id = al.image_db_id
  AND r.product_id IS NOT NULL
  AND al.product_id IS NULL;
