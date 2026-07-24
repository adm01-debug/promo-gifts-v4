-- cf_recon_20260617_soft_delete_missing
-- Applied to DB at 2026-06-17 12:34:55 UTC.
-- Repo file reconstructed 2026-06-19 from action_log evidence.
--
-- Identified 11 phantom entries in _cf_images_audit:
--   - Not found in Cloudflare (CF batch_check = MISSING)
--   - Not found in product_images (active or inactive)
-- These were ghost entries left from the initial audit materialization.
-- All were Asia-import IDs that were never successfully uploaded.
--
-- Action: log each phantom in cf_recon.action_log, then remove from audit.

INSERT INTO cf_recon.action_log
  (actor, action, image_db_id, cf_image_id, old_status, new_status, evidence, reversible)
VALUES
  ('claude','delete_phantom_from_audit',NULL,'asia-cad165-08','in_audit_no_cf_no_db','deleted',
   '{"reason":"Phantom entry: not in CF (batch_check=missing), no product_images record (active or inactive)","reversible":false,"cleanup_session":"2026-06-17 gap2_resolution","cf_batch_check_at":"2026-06-17 19:06:16.062127+00","original_uploaded":"2026-06-10 17:25:00+00 (batch timestamp from backfill migration)","original_meta_source":"product_images_verified_no_audit","product_images_check":"NULL (active+inactive)","cf_batch_check_result":"MISSING"}'::jsonb,
   false),
  ('claude','delete_phantom_from_audit',NULL,'asia-cad165-09','in_audit_no_cf_no_db','deleted',
   '{"reason":"Phantom entry: not in CF (batch_check=missing), no product_images record (active or inactive)","reversible":false,"cleanup_session":"2026-06-17 gap2_resolution","cf_batch_check_at":"2026-06-17 19:06:16.062127+00","original_uploaded":"2026-06-10 17:25:00+00 (batch timestamp from backfill migration)","original_meta_source":"product_images_verified_no_audit","product_images_check":"NULL (active+inactive)","cf_batch_check_result":"MISSING"}'::jsonb,
   false),
  ('claude','delete_phantom_from_audit',NULL,'asia-cj100-02','in_audit_no_cf_no_db','deleted',
   '{"reason":"Phantom entry: not in CF (batch_check=missing), no product_images record (active or inactive)","reversible":false,"cleanup_session":"2026-06-17 gap2_resolution","cf_batch_check_at":"2026-06-17 19:06:16.062127+00","original_uploaded":"2026-06-10 17:25:00+00 (batch timestamp from backfill migration)","original_meta_source":"product_images_verified_no_audit","product_images_check":"NULL (active+inactive)","cf_batch_check_result":"MISSING"}'::jsonb,
   false),
  ('claude','delete_phantom_from_audit',NULL,'asia-cj100-03','in_audit_no_cf_no_db','deleted',
   '{"reason":"Phantom entry: not in CF (batch_check=missing), no product_images record (active or inactive)","reversible":false,"cleanup_session":"2026-06-17 gap2_resolution","cf_batch_check_at":"2026-06-17 19:06:16.062127+00","original_uploaded":"2026-06-10 17:25:00+00 (batch timestamp from backfill migration)","original_meta_source":"product_images_verified_no_audit","product_images_check":"NULL (active+inactive)","cf_batch_check_result":"MISSING"}'::jsonb,
   false),
  ('claude','delete_phantom_from_audit',NULL,'asia-co022-01','in_audit_no_cf_no_db','deleted',
   '{"reason":"Phantom entry: not in CF (batch_check=missing), no product_images record (active or inactive)","reversible":false,"cleanup_session":"2026-06-17 gap2_resolution","cf_batch_check_at":"2026-06-17 19:06:16.062127+00","original_uploaded":"2026-06-10 17:25:00+00 (batch timestamp from backfill migration)","original_meta_source":"product_images_verified_no_audit","product_images_check":"NULL (active+inactive)","cf_batch_check_result":"MISSING"}'::jsonb,
   false),
  ('claude','delete_phantom_from_audit',NULL,'asia-co022-07','in_audit_no_cf_no_db','deleted',
   '{"reason":"Phantom entry: not in CF (batch_check=missing), no product_images record (active or inactive)","reversible":false,"cleanup_session":"2026-06-17 gap2_resolution","cf_batch_check_at":"2026-06-17 19:06:16.062127+00","original_uploaded":"2026-06-10 17:25:00+00 (batch timestamp from backfill migration)","original_meta_source":"product_images_verified_no_audit","product_images_check":"NULL (active+inactive)","cf_batch_check_result":"MISSING"}'::jsonb,
   false),
  ('claude','delete_phantom_from_audit',NULL,'asia-co9300-08','in_audit_no_cf_no_db','deleted',
   '{"reason":"Phantom entry: not in CF (batch_check=missing), no product_images record (active or inactive)","reversible":false,"cleanup_session":"2026-06-17 gap2_resolution","cf_batch_check_at":"2026-06-17 19:06:16.062127+00","original_uploaded":"2026-06-10 17:25:00+00 (batch timestamp from backfill migration)","original_meta_source":"product_images_verified_no_audit","product_images_check":"NULL (active+inactive)","cf_batch_check_result":"MISSING"}'::jsonb,
   false),
  ('claude','delete_phantom_from_audit',NULL,'asia-co9300-09','in_audit_no_cf_no_db','deleted',
   '{"reason":"Phantom entry: not in CF (batch_check=missing), no product_images record (active or inactive)","reversible":false,"cleanup_session":"2026-06-17 gap2_resolution","cf_batch_check_at":"2026-06-17 19:06:16.062127+00","original_uploaded":"2026-06-10 17:25:00+00 (batch timestamp from backfill migration)","original_meta_source":"product_images_verified_no_audit","product_images_check":"NULL (active+inactive)","cf_batch_check_result":"MISSING"}'::jsonb,
   false),
  ('claude','delete_phantom_from_audit',NULL,'asia-ga7520-03','in_audit_no_cf_no_db','deleted',
   '{"reason":"Phantom entry: not in CF (batch_check=missing), no product_images record (active or inactive)","reversible":false,"cleanup_session":"2026-06-17 gap2_resolution","cf_batch_check_at":"2026-06-17 19:06:16.062127+00","original_uploaded":"2026-06-10 17:25:00+00 (batch timestamp from backfill migration)","original_meta_source":"product_images_verified_no_audit","product_images_check":"NULL (active+inactive)","cf_batch_check_result":"MISSING"}'::jsonb,
   false),
  ('claude','delete_phantom_from_audit',NULL,'asia-ga7520-04','in_audit_no_cf_no_db','deleted',
   '{"reason":"Phantom entry: not in CF (batch_check=missing), no product_images record (active or inactive)","reversible":false,"cleanup_session":"2026-06-17 gap2_resolution","cf_batch_check_at":"2026-06-17 19:06:16.062127+00","original_uploaded":"2026-06-10 17:25:00+00 (batch timestamp from backfill migration)","original_meta_source":"product_images_verified_no_audit","product_images_check":"NULL (active+inactive)","cf_batch_check_result":"MISSING"}'::jsonb,
   false),
  ('claude','delete_phantom_from_audit',NULL,'asia-ga9200-02','in_audit_no_cf_no_db','deleted',
   '{"reason":"Phantom entry: not in CF (batch_check=missing), no product_images record (active or inactive)","reversible":false,"cleanup_session":"2026-06-17 gap2_resolution","cf_batch_check_at":"2026-06-17 19:06:16.062127+00","original_uploaded":"2026-06-10 17:25:00+00 (batch timestamp from backfill migration)","original_meta_source":"product_images_verified_no_audit","product_images_check":"NULL (active+inactive)","cf_batch_check_result":"MISSING"}'::jsonb,
   false)
ON CONFLICT DO NOTHING;

-- Physical deletion from audit table (idempotent: table may no longer exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_cf_images_audit'
  ) THEN
    DELETE FROM public._cf_images_audit
    WHERE cf_id IN (
      'asia-cad165-08','asia-cad165-09','asia-cj100-02','asia-cj100-03',
      'asia-co022-01','asia-co022-07','asia-co9300-08','asia-co9300-09',
      'asia-ga7520-03','asia-ga7520-04','asia-ga9200-02'
    );
  END IF;
END $$;
