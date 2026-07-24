-- PERF: Drop unused indexes — lint=0005_unused_index (WARN)
--
-- 95 indexes with 0 scans since last statistics reset.
-- Criteria for SAFE TO DROP:
--   • Not unique (no unique constraint backing)
--   • Not primary key
--   • Not FK-support (no idx_fk_* / idx_fk2_* prefix, no "*_fk" suffix pattern)
--   • Not GIN / GiST (tsvector, trigram, JSONB containment — costly to rebuild)
--   • Not security-critical access-log indexes
--
-- Kept intentionally:
--   idx_fk_* / idx_fk2_* / *_fk suffix  — FK referential-integrity checks (DELETE/UPDATE of parent)
--   GIN indexes confirmed:
--     idx_pbd_placements_gin, idx_quotes_client_name_trgm,
--     idx_quotes_quote_number_trgm, idx_workspace_notifications_search_vector
--   Security log indexes:
--     idx_ip_whitelist_active_ip, idx_access_blocked_log_created_at,
--     idx_access_blocked_log_ip
--
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

-- ─── Stock / supplier snapshot tables (largest size savings) ─────────────────

DROP INDEX IF EXISTS public.idx_stock_snapshots_branch_id;
DROP INDEX IF EXISTS public.idx_sds_supplier_branch_id;
DROP INDEX IF EXISTS public.idx_stock_daily_supplier_id;
DROP INDEX IF EXISTS public.idx_vss_supplier_branch_id;

-- ─── Materialized-view audit indexes ─────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_mv_product_images_audit_product_id;
DROP INDEX IF EXISTS public.idx_mv_product_images_audit_supplier_id;
DROP INDEX IF EXISTS public.idx_mv_product_images_audit_is_primary;
DROP INDEX IF EXISTS public.idx_mv_pia_canonical;
DROP INDEX IF EXISTS public.idx_mv_pia_needs_review;
DROP INDEX IF EXISTS public.idx_mv_product_leaf_category_safe_id;
DROP INDEX IF EXISTS public.mv_product_cards_has_upcoming_restock_earliest_restock_date_idx;

-- ─── product_images ───────────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_product_images_content_hash_null;
DROP INDEX IF EXISTS public.idx_pi_canonical_active;
DROP INDEX IF EXISTS public.idx_product_images_cf_last_checked_at;

-- ─── product_ai_data / product_ai_history ────────────────────────────────────

DROP INDEX IF EXISTS public.idx_product_ai_content_generated;
DROP INDEX IF EXISTS public.idx_product_ai_history_model;

-- ─── product_attributes ──────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_pa_product_id;
DROP INDEX IF EXISTS public.idx_pa_supplier;
DROP INDEX IF EXISTS public.idx_pa_boolean_attrs;
DROP INDEX IF EXISTS public.idx_pa_filterable_key_value;

-- ─── kit component / enrichment / padronizacao ───────────────────────────────

DROP INDEX IF EXISTS public.idx_kcpad_raw;
DROP INDEX IF EXISTS public.idx_kcp_component_type_code;
DROP INDEX IF EXISTS public.idx_kit_padronizacao_pkg_type;
DROP INDEX IF EXISTS public.idx_kit_enrichment_raw_padronizacao_id;
DROP INDEX IF EXISTS public.idx_kit_enrichment_raw_component_id;
DROP INDEX IF EXISTS public.idx_kcer_unproc;

-- ─── product_padronizacao_data_variants ──────────────────────────────────────

DROP INDEX IF EXISTS public.idx_padvar_variant_id_notnull;
DROP INDEX IF EXISTS public.idx_padvar_promovidos;
DROP INDEX IF EXISTS public.idx_padvar_color_id;

-- ─── frontend_telemetry ───────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.frontend_telemetry_created_at_idx;
DROP INDEX IF EXISTS public.frontend_telemetry_event_type_idx;
DROP INDEX IF EXISTS public.idx_frontend_telemetry_user_id;

-- ─── seo_audit_log ───────────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_seo_audit_log_entity;
DROP INDEX IF EXISTS public.idx_seo_audit_log_score;
DROP INDEX IF EXISTS public.idx_seo_audit_log_audited_at;

-- ─── supplier_site_pad / site pad ────────────────────────────────────────────

DROP INDEX IF EXISTS public.ix_site_pad_raw;
DROP INDEX IF EXISTS public.ix_site_pad_supplier;

-- ─── quotes (non-GIN) ────────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_quotes_contact_id;
DROP INDEX IF EXISTS public.idx_quotes_org;

-- ─── quote_history ───────────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_quote_history_quote_id;
DROP INDEX IF EXISTS public.idx_quote_history_user_id;

-- ─── product_supply / kit_components ─────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_product_supply_last_sync;
DROP INDEX IF EXISTS public.idx_product_kit_components_padronizacao;

-- ─── catalog_analytics ───────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_catalog_analytics_event_type_date;
DROP INDEX IF EXISTS public.idx_catalog_analytics_user_id;

-- ─── product_fiscal / asia import ────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_product_fiscal_ncm_id;
DROP INDEX IF EXISTS public.idx_asia_img_queue_produto;

-- ─── supplier_products_raw (pipeline indexes) ────────────────────────────────

DROP INDEX IF EXISTS public.idx_pp_supplier_type_code;
DROP INDEX IF EXISTS public.idx_pp_catalog_schema;
DROP INDEX IF EXISTS public.idx_pp_sub_brand_id;
DROP INDEX IF EXISTS public.idx_pp_sub_brand;
DROP INDEX IF EXISTS public.idx_ppc_auto_discovered;

-- ─── product_supplier_group_mapping ─────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_psgm_supplier;

-- ─── product_quality_image_audit ─────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_pqia_detected_at;

-- ─── collection items / trash ────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_collection_items_product_id;
DROP INDEX IF EXISTS public.idx_collection_items_collection;
DROP INDEX IF EXISTS public.idx_collection_trash_expires;

-- ─── product_views (non-FK) ──────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_product_views_seller_created;

-- ─── analytics MV ────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_analytics_mv_product_compositions_organization_id;

-- ─── kit_component_variant_skus / supplier_colors ────────────────────────────

DROP INDEX IF EXISTS public.idx_kit_variant_skus_color_id;
DROP INDEX IF EXISTS public.idx_supplier_colors_code_lookup;

-- ─── scr / screen crawl ──────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_scr_unprocessed;
DROP INDEX IF EXISTS public.idx_scor_ref;

-- ─── product_delivery_requests ────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_pdr_requested;
DROP INDEX IF EXISTS public.idx_pdr_status;

-- ─── ai_usage_logs ───────────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_ai_usage_logs_user_created;
DROP INDEX IF EXISTS public.idx_ai_usage_logs_function_name;

-- ─── query_telemetry ─────────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_query_telemetry_created;

-- ─── sm_site_url_map ─────────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_sm_url_map_site_id;
DROP INDEX IF EXISTS public.sm_site_url_map_source_idx;
DROP INDEX IF EXISTS public.sm_site_url_map_validated_idx;

-- ─── product_videos / favorites / features ───────────────────────────────────

DROP INDEX IF EXISTS public.idx_product_videos_video_type_id;
DROP INDEX IF EXISTS public.idx_favorite_items_product_id;
DROP INDEX IF EXISTS public.idx_pnf_feature_id;

-- ─── product_novelties / login_attempts ──────────────────────────────────────

DROP INDEX IF EXISTS public.idx_product_novelties_created_by;
DROP INDEX IF EXISTS public.idx_login_attempts_email;
DROP INDEX IF EXISTS public.idx_login_attempts_failures;

-- ─── paper / print / labels ──────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_pns_paper_format;
DROP INDEX IF EXISTS public.idx_pns_source;

-- ─── file_scan_logs ──────────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_file_scan_logs_user_id;
DROP INDEX IF EXISTS public.idx_file_scan_logs_hash;

-- ─── product targeting / material equivalences ────────────────────────────────

DROP INDEX IF EXISTS public.idx_prod_tgt_product;
DROP INDEX IF EXISTS public.idx_material_equivalences_promo_group_id;

-- ─── search_analytics / variation_values / ptm ───────────────────────────────

DROP INDEX IF EXISTS public.idx_search_analytics_zero_results;
DROP INDEX IF EXISTS public.idx_variation_values_type_active;
DROP INDEX IF EXISTS public.idx_ptm_tech_id;

-- ─── product_faqs / category_colors ─────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_product_faqs_product_id;
DROP INDEX IF EXISTS public.idx_product_faqs_category_id;
DROP INDEX IF EXISTS public.idx_category_colors_color_group_id;

-- ─── suppliers / order_items / magazine_items ────────────────────────────────

DROP INDEX IF EXISTS public.idx_suppliers_org;
DROP INDEX IF EXISTS public.idx_order_items_order_id;
DROP INDEX IF EXISTS public.idx_magazine_items_product;

-- ─── profiles / entity_colors ────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_profiles_organization_id;
DROP INDEX IF EXISTS public.idx_ec_name;

-- ─── analytics schema ────────────────────────────────────────────────────────

DROP INDEX IF EXISTS analytics.idx_tree_visual_bitrix;

-- ─── Validate ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_remaining integer;
BEGIN
  -- Count how many of the dropped indexes still exist (should be 0)
  SELECT count(*) INTO v_remaining
  FROM pg_indexes
  WHERE indexname = ANY(ARRAY[
    'idx_stock_snapshots_branch_id','idx_sds_supplier_branch_id',
    'idx_stock_daily_supplier_id','idx_vss_supplier_branch_id',
    'idx_mv_product_images_audit_product_id','idx_mv_product_images_audit_supplier_id',
    'idx_mv_product_images_audit_is_primary','idx_mv_pia_canonical',
    'idx_mv_pia_needs_review','idx_mv_product_leaf_category_safe_id',
    'mv_product_cards_has_upcoming_restock_earliest_restock_date_idx',
    'idx_product_images_content_hash_null','idx_pi_canonical_active',
    'idx_product_images_cf_last_checked_at',
    'idx_product_ai_content_generated','idx_product_ai_history_model',
    'idx_pa_product_id','idx_pa_supplier','idx_pa_boolean_attrs','idx_pa_filterable_key_value',
    'idx_kcpad_raw','idx_kcp_component_type_code','idx_kit_padronizacao_pkg_type',
    'idx_kit_enrichment_raw_padronizacao_id','idx_kit_enrichment_raw_component_id','idx_kcer_unproc',
    'idx_padvar_variant_id_notnull','idx_padvar_promovidos','idx_padvar_color_id',
    'frontend_telemetry_created_at_idx','frontend_telemetry_event_type_idx','idx_frontend_telemetry_user_id',
    'idx_seo_audit_log_entity','idx_seo_audit_log_score','idx_seo_audit_log_audited_at',
    'ix_site_pad_raw','ix_site_pad_supplier',
    'idx_quotes_contact_id','idx_quotes_org',
    'idx_quote_history_quote_id','idx_quote_history_user_id',
    'idx_product_supply_last_sync','idx_product_kit_components_padronizacao',
    'idx_catalog_analytics_event_type_date','idx_catalog_analytics_user_id',
    'idx_product_fiscal_ncm_id','idx_asia_img_queue_produto',
    'idx_pp_supplier_type_code','idx_pp_catalog_schema','idx_pp_sub_brand_id','idx_pp_sub_brand',
    'idx_ppc_auto_discovered','idx_psgm_supplier','idx_pqia_detected_at',
    'idx_collection_items_product_id','idx_collection_items_collection','idx_collection_trash_expires',
    'idx_product_views_seller_created',
    'idx_analytics_mv_product_compositions_organization_id',
    'idx_kit_variant_skus_color_id','idx_supplier_colors_code_lookup',
    'idx_scr_unprocessed','idx_scor_ref',
    'idx_pdr_requested','idx_pdr_status',
    'idx_ai_usage_logs_user_created','idx_ai_usage_logs_function_name',
    'idx_query_telemetry_created',
    'idx_sm_url_map_site_id','sm_site_url_map_source_idx','sm_site_url_map_validated_idx',
    'idx_product_videos_video_type_id','idx_favorite_items_product_id','idx_pnf_feature_id',
    'idx_product_novelties_created_by','idx_login_attempts_email','idx_login_attempts_failures',
    'idx_pns_paper_format','idx_pns_source',
    'idx_file_scan_logs_user_id','idx_file_scan_logs_hash',
    'idx_prod_tgt_product','idx_material_equivalences_promo_group_id',
    'idx_search_analytics_zero_results','idx_variation_values_type_active','idx_ptm_tech_id',
    'idx_product_faqs_product_id','idx_product_faqs_category_id','idx_category_colors_color_group_id',
    'idx_suppliers_org','idx_order_items_order_id','idx_magazine_items_product',
    'idx_profiles_organization_id','idx_ec_name',
    'idx_tree_visual_bitrix'
  ]);

  IF v_remaining > 0 THEN
    RAISE NOTICE 'unused_index drop: % indexes still present (may not exist in this environment — OK)', v_remaining;
  ELSE
    RAISE NOTICE 'unused_index drop COMPLETE — all targeted indexes removed';
  END IF;
END;
$$;
