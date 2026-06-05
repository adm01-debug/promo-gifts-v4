-- =============================================================================
-- BUG #1 FIX (partial): Register repo migration versions in schema_migrations
--
-- The DB applied these migrations under MCP-assigned timestamps, but the repo
-- files have different (intended) version IDs. Register the repo versions so
-- `supabase db push` does not try to re-apply them.
--
-- Mapping: DB applied version → repo file version (same SQL content)
--   20260605001811 → 20260605120000  spr2_state_integrity_and_wiring
--   20260605001830 → 20260605120100  spr2_images_generated_drop_claimed
--   20260605001850 → 20260605120200  spr2_motor_quarantine_terminal
--   20260605001911 → 20260605120300  spr2_history_old_version_and_index_cleanup
--   20260605001917 → 20260605120400  spr2_autovacuum_tuning
--   20260605002044 → 20260605001000  harden_fn_clean_spot_name_unicode_spaces
--   20260605010642 → 20260605130000  spr2_fix_motor_quarantine_terminal
--   20260605010707 → 20260605130100  spr2_fix_idx_unprocessed_predicate
--   20260605011613 → 20260605140000  fix_purge_history_security_and_history_indexes
--   20260605012231 → 20260605141000  fix_spr_before_write_search_path
--   20260605110418 → 20260605110225  bug4_supplier_settings_and_cleanup
-- =============================================================================

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES
  ('20260605120000', 'spr2_state_integrity_and_wiring'),
  ('20260605120100', 'spr2_images_generated_drop_claimed'),
  ('20260605120200', 'spr2_motor_quarantine_terminal'),
  ('20260605120300', 'spr2_history_old_version_and_index_cleanup'),
  ('20260605120400', 'spr2_autovacuum_tuning'),
  ('20260605001000', 'harden_fn_clean_spot_name_unicode_spaces'),
  ('20260605130000', 'spr2_fix_motor_quarantine_terminal'),
  ('20260605130100', 'spr2_fix_idx_unprocessed_predicate'),
  ('20260605140000', 'fix_purge_history_security_and_history_indexes'),
  ('20260605141000', 'fix_spr_before_write_search_path'),
  ('20260605110225', 'bug4_supplier_settings_and_cleanup')
ON CONFLICT (version) DO NOTHING;
