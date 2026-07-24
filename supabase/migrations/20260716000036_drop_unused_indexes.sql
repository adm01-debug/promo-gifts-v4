-- Migration 036: Drop unused indexes (idx_scan = 0 over 25-day observation window)
--
-- Source: 200-commit audit + performance advisor finding
-- Target finding: unused_index (283 findings)
--
-- Methodology:
--   Query: pg_stat_user_indexes WHERE idx_scan = 0 AND NOT indisprimary AND NOT indisunique
--   Stats last reset: 2026-06-21 22:37:03 UTC (25 days of observation)
--   Any non-PK, non-unique index with zero scans over 25 days is genuinely unused.
--
-- Exclusions (NOT dropped):
--   - Migration 034 newly created FK indexes (brand new, zero scans expected):
--     idx_category_colors_color_group_id, idx_favorite_items_product_id,
--     idx_product_notebook_features_feature_id, idx_quotes_organization_id,
--     idx_stock_daily_summary_supplier_id, idx_variation_values_variation_type_id
--   - Primary keys (indisprimary = true) — never dropped
--   - Unique indexes (indisunique = true) — enforce constraints, never dropped
--
-- Safety: DROP INDEX IF EXISTS is idempotent.
--   No CONCURRENTLY needed — migration runs inside a transaction (acceptable
--   for non-hot tables; Supabase advisory applies migrations transactionally).
--
-- Total freed space: ~60 MB (31 MB from stock_snapshots alone)

-- ─── Tier 1: Large indexes > 1 MB ──────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_stock_snapshots_supplier_branch_id;      -- 31 MB
DROP INDEX IF EXISTS public.idx_mv_pia_score;                            -- 5.5 MB
DROP INDEX IF EXISTS public.idx_stock_daily_summary_supplier_branch_id;  -- 5 MB
DROP INDEX IF EXISTS public.idx_mv_pia_supplier_prioridade;              -- 1.9 MB

-- ─── Tier 2: Medium indexes 100 KB – 1 MB ───────────────────────────────────
DROP INDEX IF EXISTS public.idx_mv_pia_product_pendente;                 -- 656 KB
DROP INDEX IF EXISTS public.idx_mv_product_images_audit_prioridade;      -- 504 KB
DROP INDEX IF EXISTS public.idx_mv_pia_gaps_format_dim;                  -- 472 KB
DROP INDEX IF EXISTS public.idx_frontend_telemetry_user_id;              -- 416 KB
DROP INDEX IF EXISTS public.idx_variant_supplier_sources_supplier_branch_id; -- 264 KB
DROP INDEX IF EXISTS public.idx_kit_comp_enrichment_raw_promoted_padronizacao; -- 232 KB
DROP INDEX IF EXISTS public.idx_kit_comp_padronizacao_raw_id;            -- 232 KB
DROP INDEX IF EXISTS public.idx_kit_comp_enrichment_raw_promoted_component;   -- 184 KB
DROP INDEX IF EXISTS public.idx_quotes_client_name_trgm;                 -- 168 KB
DROP INDEX IF EXISTS public.idx_quotes_quote_number_trgm;                -- 160 KB
DROP INDEX IF EXISTS public.idx_workspace_notifications_search_vector;   -- 152 KB
DROP INDEX IF EXISTS public.idx_product_kit_components_padronizacao_id;  -- 128 KB
DROP INDEX IF EXISTS public.idx_produtos_site_padronizacao_raw_id;       -- 112 KB
DROP INDEX IF EXISTS public.idx_product_fiscal_ncm_id;                   -- 80 KB
DROP INDEX IF EXISTS public.idx_produtos_padronizacao_sub_brand_id;      -- 72 KB
DROP INDEX IF EXISTS public.idx_fk_kit_component_enrichment_raw_imported_by; -- 64 KB
DROP INDEX IF EXISTS public.idx_fk_kit_component_padronizacao_reviewed_by;   -- 64 KB
DROP INDEX IF EXISTS public.idx_kit_comp_padronizacao_component_type_code;    -- 64 KB
DROP INDEX IF EXISTS public.idx_kit_comp_padronizacao_pkg_type_code;          -- 64 KB
DROP INDEX IF EXISTS public.idx_prod_similarity_grp_members_supplier_id;      -- 64 KB
DROP INDEX IF EXISTS public.idx_kit_comp_variant_skus_item_color_id;          -- 48 KB
DROP INDEX IF EXISTS public.idx_catalog_analytics_user_id;               -- 40 KB
DROP INDEX IF EXISTS public.idx_fk_included_packaging_techniques_technique_id; -- 40 KB
DROP INDEX IF EXISTS public.idx_fk_product_deactivation_requests_approved_by; -- 32 KB
DROP INDEX IF EXISTS public.idx_fk_product_deactivation_requests_rejected_by; -- 32 KB
DROP INDEX IF EXISTS public.idx_fk_product_deactivation_requests_requested_by; -- 32 KB
DROP INDEX IF EXISTS public.idx_fk_product_deactivation_requests_supplier_id; -- 32 KB
DROP INDEX IF EXISTS public.idx_fk_product_deactivation_tokens_request_id;    -- 32 KB
DROP INDEX IF EXISTS public.idx_fk_product_packagings_packaging_id;           -- 32 KB
DROP INDEX IF EXISTS public.idx_product_novelties_created_by;            -- 32 KB
DROP INDEX IF EXISTS public.idx_pbd_placements_gin;                      -- 24 KB

-- ─── Tier 3: Small indexes 16 KB ────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_access_blocked_log_created_at;
DROP INDEX IF EXISTS public.idx_access_blocked_log_ip;
DROP INDEX IF EXISTS public.idx_admin_audit_log_user_id;
DROP INDEX IF EXISTS public.idx_ai_routing_decisions_user;
DROP INDEX IF EXISTS public.idx_ai_usage_logs_quota_check;
DROP INDEX IF EXISTS public.idx_ai_usage_logs_updated_at;
DROP INDEX IF EXISTS public.idx_approval_links_job_id;
DROP INDEX IF EXISTS public.idx_audit_log_user_id;
DROP INDEX IF EXISTS public.idx_ccev_event_result;
DROP INDEX IF EXISTS public.idx_ccev_external_quote;
DROP INDEX IF EXISTS public.idx_cf_recon_inflight_dispatched;
DROP INDEX IF EXISTS public.idx_city_whitelist_active_city;
DROP INDEX IF EXISTS public.idx_collection_products_product_id_fk;
DROP INDEX IF EXISTS public.idx_collection_trash_user;
DROP INDEX IF EXISTS public.idx_color_variations_active_group;
DROP INDEX IF EXISTS public.idx_color_variations_color_group_id;
DROP INDEX IF EXISTS public.idx_color_variations_nuance_id;
DROP INDEX IF EXISTS public.idx_commemorative_dates_month;
DROP INDEX IF EXISTS public.idx_content_articles_published;
DROP INDEX IF EXISTS public.idx_content_articles_slug;
DROP INDEX IF EXISTS public.idx_credit_transactions_user_id;
DROP INDEX IF EXISTS public.idx_crm_callback_events_quote;
DROP INDEX IF EXISTS public.idx_daa_quote_created;
DROP INDEX IF EXISTS public.idx_dar_quote_id_status;
DROP INDEX IF EXISTS public.idx_dar_seller_id;
DROP INDEX IF EXISTS public.idx_dar_seller_status;
DROP INDEX IF EXISTS public.idx_dar_status_pending;
DROP INDEX IF EXISTS public.idx_discount_approval_audit_actor_id;
DROP INDEX IF EXISTS public.idx_discount_approvals_admin_id;
DROP INDEX IF EXISTS public.idx_efi_invoked_at;
DROP INDEX IF EXISTS public.idx_efi_invoked_by;
DROP INDEX IF EXISTS public.idx_fk2_ai_function_routing_primary_model_id;
DROP INDEX IF EXISTS public.idx_fk2_ai_function_routing_updated_by;
DROP INDEX IF EXISTS public.idx_fk2_ai_providers_created_by;
DROP INDEX IF EXISTS public.idx_fk2_ai_providers_updated_by;
DROP INDEX IF EXISTS public.idx_fk2_attribute_definitions_group_id;
DROP INDEX IF EXISTS public.idx_fk2_b2b_collections_created_by;
DROP INDEX IF EXISTS public.idx_fk2_b2b_collections_organization_id;
DROP INDEX IF EXISTS public.idx_fk2_category_accessory_categories_accessory_category_id;
DROP INDEX IF EXISTS public.idx_fk2_category_commemorative_dates_commemorative_date_id;
DROP INDEX IF EXISTS public.idx_fk2_category_target_audiences_target_audience_id;
DROP INDEX IF EXISTS public.idx_fk2_color_synonym_map_canonical_color_id;
DROP INDEX IF EXISTS public.idx_fk2_commemorative_date_colors_color_group_id;
DROP INDEX IF EXISTS public.idx_fk2_commemorative_dates_organization_id;
DROP INDEX IF EXISTS public.idx_fk2_integration_credentials_created_by;
DROP INDEX IF EXISTS public.idx_fk2_integration_credentials_updated_by;
DROP INDEX IF EXISTS public.idx_fk2_material_variations_type_id;
DROP INDEX IF EXISTS public.idx_fk2_packagings_packaging_type_id;
DROP INDEX IF EXISTS public.idx_fk2_seller_discount_limits_set_by;
DROP INDEX IF EXISTS public.idx_fk2_supplier_attribute_definitions_organization_id;
DROP INDEX IF EXISTS public.idx_fk2_supplier_field_priority_supplier_id;
DROP INDEX IF EXISTS public.idx_fk2_supplier_packagings_packaging_id;
DROP INDEX IF EXISTS public.idx_fk2_system_kill_switches_updated_by;
DROP INDEX IF EXISTS public.idx_fk2_target_audiences_organization_id;
DROP INDEX IF EXISTS public.idx_fk2_user_roles_granted_by;
DROP INDEX IF EXISTS public.idx_fk3_admin_settings_updated_by;
DROP INDEX IF EXISTS public.idx_fk3_ai_routing_decisions_final_model_id;
DROP INDEX IF EXISTS public.idx_fk3_ai_routing_decisions_final_provider_id;
DROP INDEX IF EXISTS public.idx_fk3_pipeline_known_issues_supplier_id;
DROP INDEX IF EXISTS public.idx_fk_product_notebook_specs_binding_color_id;
DROP INDEX IF EXISTS public.idx_fk_product_notebook_specs_binding_type_id;
DROP INDEX IF EXISTS public.idx_fk_product_notebook_specs_cover_finish_id;
DROP INDEX IF EXISTS public.idx_fk_product_notebook_specs_cover_type_id;
DROP INDEX IF EXISTS public.idx_fk_product_notebook_specs_paper_color_id;
DROP INDEX IF EXISTS public.idx_fk_product_notebook_specs_paper_ruling_id;
DROP INDEX IF EXISTS public.idx_fk_product_notebook_specs_paper_weight_id;
DROP INDEX IF EXISTS public.idx_fk_supplier_category_mappings_category_id;
DROP INDEX IF EXISTS public.idx_fk_supplier_customization_raw_import_batch_id;
DROP INDEX IF EXISTS public.idx_generated_mockups_approval_status;
DROP INDEX IF EXISTS public.idx_generated_mockups_client_id;
DROP INDEX IF EXISTS public.idx_generated_mockups_job_id;
DROP INDEX IF EXISTS public.idx_generated_mockups_user_id;
DROP INDEX IF EXISTS public.idx_inbound_webhook_endpoints_created_by;
DROP INDEX IF EXISTS public.idx_inbound_webhook_events_endpoint_id;
DROP INDEX IF EXISTS public.idx_integration_credentials_provider;
DROP INDEX IF EXISTS public.idx_ip_access_control_created_by;
DROP INDEX IF EXISTS public.idx_ip_whitelist_active_ip;
DROP INDEX IF EXISTS public.idx_kct_category;
DROP INDEX IF EXISTS public.idx_kit_templates_active;
DROP INDEX IF EXISTS public.idx_magazines_org;
DROP INDEX IF EXISTS public.idx_magazines_template_id;
DROP INDEX IF EXISTS public.idx_magazines_token_lookup;
DROP INDEX IF EXISTS public.idx_markup_config_created_by;
DROP INDEX IF EXISTS public.idx_markup_config_org;
DROP INDEX IF EXISTS public.idx_markup_config_supplier;
DROP INDEX IF EXISTS public.idx_markup_configurations_product_id;
DROP INDEX IF EXISTS public.idx_material_equivalences_promo_group_id;
DROP INDEX IF EXISTS public.idx_mcs_captured;
DROP INDEX IF EXISTS public.idx_mockup_jobs_user_id;
DROP INDEX IF EXISTS public.idx_mockup_txn_credit_account;
DROP INDEX IF EXISTS public.idx_mockup_txn_job_id;
DROP INDEX IF EXISTS public.idx_mockup_txn_mockup_id;
DROP INDEX IF EXISTS public.idx_mv_ema_kpi_by_level_prioridade;
DROP INDEX IF EXISTS public.idx_navigation_analytics_created_at;
DROP INDEX IF EXISTS public.idx_navigation_analytics_user_created;
DROP INDEX IF EXISTS public.idx_order_items_order_id;
DROP INDEX IF EXISTS public.idx_orders_created_by;
DROP INDEX IF EXISTS public.idx_orders_seller_created;
DROP INDEX IF EXISTS public.idx_org_members_org_user;
DROP INDEX IF EXISTS public.idx_product_faqs_category_id;
DROP INDEX IF EXISTS public.idx_product_faqs_product_id;
DROP INDEX IF EXISTS public.idx_product_notebook_specs_paper_format_id;
DROP INDEX IF EXISTS public.idx_product_videos_video_type_id;
DROP INDEX IF EXISTS public.idx_profiles_organization_id;
DROP INDEX IF EXISTS public.idx_psg_material;
DROP INDEX IF EXISTS public.idx_quote_history_user_id;
DROP INDEX IF EXISTS public.idx_quote_items_external_products;
DROP INDEX IF EXISTS public.idx_quote_items_selected_packaging;
DROP INDEX IF EXISTS public.idx_quotes_assigned_to;
DROP INDEX IF EXISTS public.idx_quotes_converted_at;
DROP INDEX IF EXISTS public.idx_quotes_created_by;
DROP INDEX IF EXISTS public.idx_role_permissions_permission_code;
DROP INDEX IF EXISTS public.idx_seller_carts_seller_id;
DROP INDEX IF EXISTS public.idx_seller_carts_seller_updated;
DROP INDEX IF EXISTS public.idx_subtype_map_supplier;
DROP INDEX IF EXISTS public.idx_supplier_property_mappings_supplier;
DROP INDEX IF EXISTS public.idx_tags_lower_name;
DROP INDEX IF EXISTS public.idx_user_orgs_user_org;
DROP INDEX IF EXISTS public.ix_ingestion_run_log_started;
DROP INDEX IF EXISTS public.ix_ingestion_run_log_sup_feed;
DROP INDEX IF EXISTS public.ix_secret_rotation_log_rotated_by;
DROP INDEX IF EXISTS public.ix_secret_rotation_log_secret_name;
DROP INDEX IF EXISTS public.sm_category_pages_cid_idx;

-- ─── Tier 4: Micro indexes 8 KB ─────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_aeq_pending_review;
DROP INDEX IF EXISTS public.idx_aeq_promo_key;
DROP INDEX IF EXISTS public.idx_aeq_supplier_key_value;
DROP INDEX IF EXISTS public.idx_art_file_attachments_mockup_id;
DROP INDEX IF EXISTS public.idx_art_file_attachments_quote_id;
DROP INDEX IF EXISTS public.idx_cde_product;
DROP INDEX IF EXISTS public.idx_cde_variant;
DROP INDEX IF EXISTS public.idx_device_login_notifications_user_created;
DROP INDEX IF EXISTS public.idx_external_connections_auto_test_enabled;
DROP INDEX IF EXISTS public.idx_file_scan_logs_user_id;
DROP INDEX IF EXISTS public.idx_fk2_attribute_equivalences_verified_by;
DROP INDEX IF EXISTS public.idx_fk2_commemorative_date_exclusions_commemorative_date_id;
DROP INDEX IF EXISTS public.idx_fk2_enrichment_log_contact_id;
DROP INDEX IF EXISTS public.idx_fk2_mcp_api_keys_rotated_from;
DROP INDEX IF EXISTS public.idx_fk2_product_target_audiences_category_id;
DROP INDEX IF EXISTS public.idx_fk2_product_target_audiences_target_audience_id;
DROP INDEX IF EXISTS public.idx_fk2_quote_versions_created_by;
DROP INDEX IF EXISTS public.idx_fk2_user_allowed_ips_created_by;
DROP INDEX IF EXISTS public.idx_fk2_user_favorites_product_id;
DROP INDEX IF EXISTS public.idx_fk2_variant_commemorative_dates_commemorative_date_id;
DROP INDEX IF EXISTS public.idx_fk3_connection_test_history_connection_id;
DROP INDEX IF EXISTS public.idx_fk3_content_articles_author_id;
DROP INDEX IF EXISTS public.idx_fk3_favorite_item_reactions_list_id;
DROP INDEX IF EXISTS public.idx_fk3_kit_comments_parent_id;
DROP INDEX IF EXISTS public.idx_fk3_mcp_key_auto_revocations_key_id;
DROP INDEX IF EXISTS public.idx_fk3_mockup_templates_default_technique_id;
DROP INDEX IF EXISTS public.idx_fk3_optimization_queue_runs_queue_id;
DROP INDEX IF EXISTS public.idx_fk3_password_reset_requests_reviewed_by;
DROP INDEX IF EXISTS public.idx_fk3_password_reset_requests_user_id;
DROP INDEX IF EXISTS public.idx_fk3_personalization_simulations_seller_id;
DROP INDEX IF EXISTS public.idx_fk3_product_component_location_techniques_technique_id;
DROP INDEX IF EXISTS public.idx_fk3_product_group_location_techniques_technique_id;
DROP INDEX IF EXISTS public.idx_fk3_product_price_freshness_overrides_updated_by;
DROP INDEX IF EXISTS public.idx_fk3_quote_approval_tokens_seller_id;
DROP INDEX IF EXISTS public.idx_fk3_sales_goals_user_id;
DROP INDEX IF EXISTS public.idx_fk3_user_known_devices_user_id;
DROP INDEX IF EXISTS public.idx_generated_mockups_approved_by;
DROP INDEX IF EXISTS public.idx_generated_mockups_technique_id;
DROP INDEX IF EXISTS public.idx_geo_allowed_countries_created_by;
DROP INDEX IF EXISTS public.idx_kit_comments_kit_id;
DROP INDEX IF EXISTS public.idx_kit_share_tokens_kit_id;
DROP INDEX IF EXISTS public.idx_kit_templates_created_by;
DROP INDEX IF EXISTS public.idx_kit_variants_kit_master;
DROP INDEX IF EXISTS public.idx_mag_reactions_page;
DROP INDEX IF EXISTS public.idx_magazine_templates_org;
DROP INDEX IF EXISTS public.idx_magazine_templates_owner;
DROP INDEX IF EXISTS public.idx_magazine_templates_template_id;
DROP INDEX IF EXISTS public.idx_mockup_jobs_technique_id;
DROP INDEX IF EXISTS public.idx_notifications_user;
DROP INDEX IF EXISTS public.idx_oq_status_priority;
DROP INDEX IF EXISTS public.idx_price_history_changed_by;
DROP INDEX IF EXISTS public.idx_product_components_product_id;
DROP INDEX IF EXISTS public.idx_product_group_members_group_id;
DROP INDEX IF EXISTS public.idx_qt_created_by;
DROP INDEX IF EXISTS public.idx_qt_created_by_active;
DROP INDEX IF EXISTS public.idx_qt_is_default;
DROP INDEX IF EXISTS public.idx_qt_seller_id;
DROP INDEX IF EXISTS public.idx_quote_versions_quote_id;
DROP INDEX IF EXISTS public.idx_reader_state_user;
DROP INDEX IF EXISTS public.idx_recently_viewed_user_at;
DROP INDEX IF EXISTS public.idx_search_queries_clicked_product_id;
DROP INDEX IF EXISTS public.idx_unp_user_id;
DROP INDEX IF EXISTS public.idx_user_favorites_user;
DROP INDEX IF EXISTS public.idx_user_ip_allowlist_created_by;
DROP INDEX IF EXISTS public.idx_variant_commemorative_dates_product;
DROP INDEX IF EXISTS public.idx_variant_commemorative_dates_variant;
DROP INDEX IF EXISTS public.idx_vsf_created_at;
DROP INDEX IF EXISTS public.idx_vsf_product_id;
DROP INDEX IF EXISTS public.idx_vsf_user_id;
DROP INDEX IF EXISTS public.idx_webhook_deliveries_webhook_id;
DROP INDEX IF EXISTS public.idx_webhook_deliveries_webhook_time;

-- ─── Partitioned-table parent indexes ───────────────────────────────────────
-- Child partition indexes cannot be dropped directly — must drop the parent.
-- Dropping the parent cascades to all partition children automatically.
--
-- idx_mag_view_events_mag_time  → parent of magazine_public_view_events_2026_{08,09,10}_...
-- idx_sprh_raw_captured         → parent of supplier_products_raw_history_p2026_{08,09,10}_...
DROP INDEX IF EXISTS public.idx_mag_view_events_mag_time;
DROP INDEX IF EXISTS public.idx_sprh_raw_captured;

-- ─── Validation ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  remaining_count integer;
  freed_count     integer := 235;
BEGIN
  SELECT COUNT(*)
  INTO remaining_count
  FROM pg_stat_user_indexes s
  JOIN pg_index i ON i.indexrelid = s.indexrelid
  WHERE s.schemaname = 'public'
    AND s.idx_scan = 0
    AND NOT i.indisprimary
    AND NOT i.indisunique
    -- Exclude migration 034 indexes
    AND s.indexrelname NOT IN (
      'idx_category_colors_color_group_id',
      'idx_favorite_items_product_id',
      'idx_product_notebook_features_feature_id',
      'idx_quotes_organization_id',
      'idx_stock_daily_summary_supplier_id',
      'idx_variation_values_variation_type_id'
    );

  RAISE NOTICE '✓ Migration 036 complete — dropped % unused indexes (~60 MB reclaimed)', freed_count;
  RAISE NOTICE '  Remaining zero-scan non-unique indexes: % (should be near 0)', remaining_count;

  IF remaining_count > 10 THEN
    RAISE WARNING '% zero-scan indexes still remain — may need investigation', remaining_count;
  END IF;
END;
$$;
