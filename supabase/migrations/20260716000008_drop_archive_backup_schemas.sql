-- CLEANUP: Drop archive.* and backup.* schemas — all tables and schemas
--
-- Context: Migration 000004 already revoked anon/authenticated access.
-- These schemas contain deprecated pipelines, one-off audit tables, and
-- point-in-time backups that have long since served their purpose.
--
-- Largest items freed:
--   archive.supplier_products_raw_history_legacy  ~5 080 MB
--   archive.image_validation_log                  ~  24 MB
--   archive._cf_images_audit                      ~  22 MB
--   backup._deprecated_silver_variants_20260606   ~  12 MB
--   backup._deprecated_silver_products_20260606   ~  10 MB
--
-- backup.xbz_suppliers_cred_bkp_20260605 stores 1 row of old_credentials
-- (jsonb). Access was revoked in 000004; dropping eliminates residual
-- credential exposure risk entirely.
--
-- Idempotent via DROP TABLE IF EXISTS / DROP SCHEMA IF EXISTS.

-- ─── archive schema ───────────────────────────────────────────────────────────
DROP TABLE IF EXISTS archive._asia_api_staging                          CASCADE;
DROP TABLE IF EXISTS archive._backup_category_icons_20260613            CASCADE;
DROP TABLE IF EXISTS archive._backup_fn_convert_cart_to_quote_20260614  CASCADE;
DROP TABLE IF EXISTS archive._backup_pv_color_hex_20260614              CASCADE;
DROP TABLE IF EXISTS archive._backup_quote_lixo_20260614                CASCADE;
DROP TABLE IF EXISTS archive._backup_quotes_orgid_null_20260614         CASCADE;
DROP TABLE IF EXISTS archive._backup_seller_cart_items_orfaos_20260614  CASCADE;
DROP TABLE IF EXISTS archive._backup_videos_cache_20260614              CASCADE;
DROP TABLE IF EXISTS archive._cf_images_audit                           CASCADE;
DROP TABLE IF EXISTS archive._deprecated_silver_print_areas_20260606    CASCADE;
DROP TABLE IF EXISTS archive._img_divergence_audit                      CASCADE;
DROP TABLE IF EXISTS archive._img_refetch_pending                       CASCADE;
DROP TABLE IF EXISTS archive._unif_pending_log                          CASCADE;
DROP TABLE IF EXISTS archive._unif_settings_arquivo                     CASCADE;
DROP TABLE IF EXISTS archive.ai_description_queue                       CASCADE;
DROP TABLE IF EXISTS archive.asia_image_import_queue_history_20260619   CASCADE;
DROP TABLE IF EXISTS archive.asia_legacy_upload_queue                   CASCADE;
DROP TABLE IF EXISTS archive.audit_log                                   CASCADE;
DROP TABLE IF EXISTS archive.audit_logs                                  CASCADE;
DROP TABLE IF EXISTS archive.auth_login_attempts                         CASCADE;
DROP TABLE IF EXISTS archive.category_icons                              CASCADE;
DROP TABLE IF EXISTS archive.cf_sm_legacy                                CASCADE;
DROP TABLE IF EXISTS archive.collection_items                            CASCADE;
DROP TABLE IF EXISTS archive.color_analysis_staging                      CASCADE;
DROP TABLE IF EXISTS archive.image_import_log                            CASCADE;
DROP TABLE IF EXISTS archive.image_validation_log                        CASCADE;
DROP TABLE IF EXISTS archive.import_staging_images                       CASCADE;
DROP TABLE IF EXISTS archive.media_assets                                CASCADE;
DROP TABLE IF EXISTS archive.media_sync_log                              CASCADE;
DROP TABLE IF EXISTS archive.media_sync_queue                            CASCADE;
DROP TABLE IF EXISTS archive.product_specifications                      CASCADE;
DROP TABLE IF EXISTS archive.scraper_checkpoints                         CASCADE;
DROP TABLE IF EXISTS archive.scraper_images_staging                      CASCADE;
DROP TABLE IF EXISTS archive.sm_images_staging                           CASCADE;
DROP TABLE IF EXISTS archive.sm_upload_mapping                           CASCADE;
DROP TABLE IF EXISTS archive.smoke_tests_runs                            CASCADE;
DROP TABLE IF EXISTS archive.spot_cf_reimport_log                        CASCADE;
DROP TABLE IF EXISTS archive.spot_cf_upload_queue                        CASCADE;
DROP TABLE IF EXISTS archive.spot_eu_image_diff_queue                    CASCADE;
DROP TABLE IF EXISTS archive.stock_movements                              CASCADE;
DROP TABLE IF EXISTS archive.supplier_image_requirements                  CASCADE;
DROP TABLE IF EXISTS archive.supplier_image_suffix_mappings               CASCADE;
DROP TABLE IF EXISTS archive.supplier_image_suffix_patterns               CASCADE;
DROP TABLE IF EXISTS archive.supplier_products_raw_history_legacy         CASCADE;
DROP TABLE IF EXISTS archive.system_settings_legacy                       CASCADE;

DROP SCHEMA IF EXISTS archive CASCADE;

-- ─── backup schema ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS backup._backup_20260425_tabela_preco_gravacao_oficial_faixa CASCADE;
DROP TABLE IF EXISTS backup._backup_20260425_tecnicas_gravacao                   CASCADE;
DROP TABLE IF EXISTS backup._backup_collection_products_b2b_20260511            CASCADE;
DROP TABLE IF EXISTS backup._backup_collections_b2b_20260511                    CASCADE;
DROP TABLE IF EXISTS backup._backup_collections_policies_b2b_20260511           CASCADE;
DROP TABLE IF EXISTS backup._backup_color_backfill_20260604                     CASCADE;
DROP TABLE IF EXISTS backup._backup_functions_d12                               CASCADE;
DROP TABLE IF EXISTS backup._backup_guardachuva_setup_20260425                  CASCADE;
DROP TABLE IF EXISTS backup._backup_plaquinha_sugestao_20260425                 CASCADE;
DROP TABLE IF EXISTS backup._backup_pp_pre_promote_20260604                     CASCADE;
DROP TABLE IF EXISTS backup._backup_ppv_pre_elos_20260604                       CASCADE;
DROP TABLE IF EXISTS backup._backup_produtos_padronizacao_20260604              CASCADE;
DROP TABLE IF EXISTS backup._backup_silk_ajustes_20260426                       CASCADE;
DROP TABLE IF EXISTS backup._backup_storage_buckets_20260511_d11               CASCADE;
DROP TABLE IF EXISTS backup._backup_storage_policies_20260511_d11              CASCADE;
DROP TABLE IF EXISTS backup._backup_system_settings_legacy_20260511            CASCADE;
DROP TABLE IF EXISTS backup._backup_unif_funcoes_20260425                      CASCADE;
DROP TABLE IF EXISTS backup._backup_unif_funcoes_f3_20260425                   CASCADE;
DROP TABLE IF EXISTS backup._backup_unif_limpeza_fatmin_20260425               CASCADE;
DROP TABLE IF EXISTS backup._backup_unif_setup_fatmin_20260425                 CASCADE;
DROP TABLE IF EXISTS backup._backup_unif_setup_fatmin_faixa_20260425           CASCADE;
DROP TABLE IF EXISTS backup._bkp_asia_raw_pre_fix_referencia                   CASCADE;
DROP TABLE IF EXISTS backup._bkp_asia_raw_pre_reload_20260606                  CASCADE;
DROP TABLE IF EXISTS backup._deprecated_silver_images_queue_20260606           CASCADE;
DROP TABLE IF EXISTS backup._deprecated_silver_products_20260606               CASCADE;
DROP TABLE IF EXISTS backup._deprecated_silver_variants_20260606               CASCADE;
DROP TABLE IF EXISTS backup.attribute_equivalences                             CASCADE;
DROP TABLE IF EXISTS backup.cutover_sm_gold_20260606                           CASCADE;
DROP TABLE IF EXISTS backup.de_para_site                                        CASCADE;
DROP TABLE IF EXISTS backup.dedup_sm_whitespace_20260606                        CASCADE;
DROP TABLE IF EXISTS backup.locked_cleanup_v2_20260606                          CASCADE;
DROP TABLE IF EXISTS backup.locked_stock_cleanup_20260606                       CASCADE;
DROP TABLE IF EXISTS backup.product_images_display_order_20260616               CASCADE;
DROP TABLE IF EXISTS backup.product_images_type_xbz_20260616                   CASCADE;
DROP TABLE IF EXISTS backup.products_imageproj_20260616                         CASCADE;
DROP TABLE IF EXISTS backup.produtos_padronizacao_bkp_20260604                 CASCADE;
DROP TABLE IF EXISTS backup.produtos_padronizacao_variantes_bkp_20260604       CASCADE;
DROP TABLE IF EXISTS backup.sfm_sm_correction_20260606                          CASCADE;
DROP TABLE IF EXISTS backup.sfm_sm_variants_before_20260606                     CASCADE;
DROP TABLE IF EXISTS backup.supplier_technique_mappings                         CASCADE;
DROP TABLE IF EXISTS backup.xbz_suppliers_cred_bkp_20260605                    CASCADE;
DROP TABLE IF EXISTS backup.xbz_vss_stock_bkp_20260605                         CASCADE;

DROP SCHEMA IF EXISTS backup CASCADE;

-- ─── Validate ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname IN ('archive', 'backup')) THEN
    RAISE EXCEPTION 'archive/backup schema drop FAILED — schemas still exist';
  END IF;
  RAISE NOTICE 'archive and backup schemas dropped — ~5.2 GB freed';
END;
$$;
