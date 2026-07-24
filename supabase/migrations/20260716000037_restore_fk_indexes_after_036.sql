-- Migration 037: Restore FK covering indexes dropped by migration 036
--
-- Source: 200-commit audit regression fix
-- Root cause: Migration 036 dropped 235 unused indexes, including indexes that
-- were covering FK columns (idx_scan=0 but still needed for integrity ops).
-- Those 162 FK columns now appear as unindexed_foreign_keys advisor findings.
--
-- Strategy: CREATE INDEX IF NOT EXISTS for all 157 unique FK columns.
-- (162 findings minus 5 partition children of magazine_public_view_events = 157;
--  one parent index on magazine_public_view_events cascades to all 5 children.)
--
-- All tables confirmed present via pg_constraint query on production DB.

-- ── A ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_admin_settings_updated_by
  ON public.admin_settings (updated_by);

CREATE INDEX IF NOT EXISTS idx_ai_function_routing_primary_model_id
  ON public.ai_function_routing (primary_model_id);

CREATE INDEX IF NOT EXISTS idx_ai_function_routing_updated_by
  ON public.ai_function_routing (updated_by);

CREATE INDEX IF NOT EXISTS idx_ai_providers_created_by
  ON public.ai_providers (created_by);

CREATE INDEX IF NOT EXISTS idx_ai_providers_updated_by
  ON public.ai_providers (updated_by);

CREATE INDEX IF NOT EXISTS idx_ai_routing_decisions_final_model_id
  ON public.ai_routing_decisions (final_model_id);

CREATE INDEX IF NOT EXISTS idx_ai_routing_decisions_final_provider_id
  ON public.ai_routing_decisions (final_provider_id);

CREATE INDEX IF NOT EXISTS idx_ai_routing_decisions_user_id
  ON public.ai_routing_decisions (user_id);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id
  ON public.ai_usage_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_attribute_definitions_group_id
  ON public.attribute_definitions (group_id);

CREATE INDEX IF NOT EXISTS idx_attribute_equivalences_verified_by
  ON public.attribute_equivalences (verified_by);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id
  ON public.audit_log (user_id);

-- ── B ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_b2b_collections_created_by
  ON public.b2b_collections (created_by);

CREATE INDEX IF NOT EXISTS idx_b2b_collections_organization_id
  ON public.b2b_collections (organization_id);

-- ── C ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_catalog_analytics_user_id
  ON public.catalog_analytics (user_id);

CREATE INDEX IF NOT EXISTS idx_catacccat_accessory_category_id
  ON public.category_accessory_categories (accessory_category_id);

CREATE INDEX IF NOT EXISTS idx_catcomdate_commemorative_date_id
  ON public.category_commemorative_dates (commemorative_date_id);

CREATE INDEX IF NOT EXISTS idx_category_target_audiences_ta_id
  ON public.category_target_audiences (target_audience_id);

CREATE INDEX IF NOT EXISTS idx_collection_products_product_id
  ON public.collection_products (product_id);

CREATE INDEX IF NOT EXISTS idx_color_synonym_map_canonical_color_id
  ON public.color_synonym_map (canonical_color_id);

CREATE INDEX IF NOT EXISTS idx_color_variations_color_group_id
  ON public.color_variations (color_group_id);

CREATE INDEX IF NOT EXISTS idx_color_variations_nuance_id
  ON public.color_variations (nuance_id);

CREATE INDEX IF NOT EXISTS idx_commemorative_date_colors_color_group_id
  ON public.commemorative_date_colors (color_group_id);

CREATE INDEX IF NOT EXISTS idx_comdate_exclusions_comdate_id
  ON public.commemorative_date_exclusions (commemorative_date_id);

CREATE INDEX IF NOT EXISTS idx_commemorative_date_exclusions_product_id
  ON public.commemorative_date_exclusions (product_id);

CREATE INDEX IF NOT EXISTS idx_commemorative_date_exclusions_variant_id
  ON public.commemorative_date_exclusions (variant_id);

CREATE INDEX IF NOT EXISTS idx_commemorative_dates_organization_id
  ON public.commemorative_dates (organization_id);

CREATE INDEX IF NOT EXISTS idx_connection_test_history_connection_id
  ON public.connection_test_history (connection_id);

CREATE INDEX IF NOT EXISTS idx_content_articles_author_id
  ON public.content_articles (author_id);

-- ── D ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_device_login_notifications_user_id
  ON public.device_login_notifications (user_id);

CREATE INDEX IF NOT EXISTS idx_discount_approval_audit_actor_id
  ON public.discount_approval_audit (actor_id);

CREATE INDEX IF NOT EXISTS idx_discount_approval_requests_admin_id
  ON public.discount_approval_requests (admin_id);

CREATE INDEX IF NOT EXISTS idx_discount_approval_requests_seller_id
  ON public.discount_approval_requests (seller_id);

-- ── E ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_edge_function_invocations_invoked_by
  ON public.edge_function_invocations (invoked_by);

CREATE INDEX IF NOT EXISTS idx_enrichment_log_contact_id
  ON public.enrichment_log (contact_id);

-- ── F ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_favorite_item_reactions_list_id
  ON public.favorite_item_reactions (list_id);

CREATE INDEX IF NOT EXISTS idx_file_scan_logs_user_id
  ON public.file_scan_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_frontend_telemetry_user_id
  ON public.frontend_telemetry (user_id);

-- ── G ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_generated_mockups_approved_by_user_id
  ON public.generated_mockups (approved_by_user_id);

CREATE INDEX IF NOT EXISTS idx_generated_mockups_job_id
  ON public.generated_mockups (job_id);

CREATE INDEX IF NOT EXISTS idx_generated_mockups_technique_id
  ON public.generated_mockups (technique_id);

CREATE INDEX IF NOT EXISTS idx_geo_allowed_countries_created_by
  ON public.geo_allowed_countries (created_by);

-- ── I ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inbound_webhook_endpoints_created_by
  ON public.inbound_webhook_endpoints (created_by);

CREATE INDEX IF NOT EXISTS idx_included_packaging_techs_technique_id
  ON public.included_packaging_techniques (technique_id);

CREATE INDEX IF NOT EXISTS idx_integration_credentials_created_by
  ON public.integration_credentials (created_by);

CREATE INDEX IF NOT EXISTS idx_integration_credentials_updated_by
  ON public.integration_credentials (updated_by);

CREATE INDEX IF NOT EXISTS idx_ip_access_control_created_by
  ON public.ip_access_control (created_by);

-- ── K ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_kit_comments_kit_id
  ON public.kit_comments (kit_id);

CREATE INDEX IF NOT EXISTS idx_kit_comments_parent_id
  ON public.kit_comments (parent_id);

CREATE INDEX IF NOT EXISTS idx_kit_component_enrichment_raw_imported_by
  ON public.kit_component_enrichment_raw (imported_by);

CREATE INDEX IF NOT EXISTS idx_kcer_promoted_component_id
  ON public.kit_component_enrichment_raw (promoted_component_id);

CREATE INDEX IF NOT EXISTS idx_kcer_promoted_padronizacao_id
  ON public.kit_component_enrichment_raw (promoted_padronizacao_id);

CREATE INDEX IF NOT EXISTS idx_kcpad_component_type_code
  ON public.kit_component_padronizacao (component_type_code);

CREATE INDEX IF NOT EXISTS idx_kcpad_pkg_type_code
  ON public.kit_component_padronizacao (pkg_type_code);

CREATE INDEX IF NOT EXISTS idx_kcpad_raw_id
  ON public.kit_component_padronizacao (raw_id);

CREATE INDEX IF NOT EXISTS idx_kcpad_reviewed_by
  ON public.kit_component_padronizacao (reviewed_by);

CREATE INDEX IF NOT EXISTS idx_kit_component_variant_skus_item_color_id
  ON public.kit_component_variant_skus (item_color_id);

CREATE INDEX IF NOT EXISTS idx_kit_share_tokens_kit_id
  ON public.kit_share_tokens (kit_id);

CREATE INDEX IF NOT EXISTS idx_kit_templates_created_by
  ON public.kit_templates (created_by);

CREATE INDEX IF NOT EXISTS idx_kit_variants_kit_master_id
  ON public.kit_variants (kit_master_id);

-- ── M ─────────────────────────────────────────────────────────────────────────
-- Partitioned table: index on parent cascades to children
-- (_2026_07, _2026_08, _2026_09, _2026_10, _default)
CREATE INDEX IF NOT EXISTS idx_magazine_pub_view_events_magazine_id
  ON public.magazine_public_view_events (magazine_id);

CREATE INDEX IF NOT EXISTS idx_magazine_reader_state_user_id
  ON public.magazine_reader_state (user_id);

CREATE INDEX IF NOT EXISTS idx_magazine_templates_organization_id
  ON public.magazine_templates (organization_id);

CREATE INDEX IF NOT EXISTS idx_magazine_templates_owner_id
  ON public.magazine_templates (owner_id);

CREATE INDEX IF NOT EXISTS idx_magazine_templates_template_id
  ON public.magazine_templates (template_id);

CREATE INDEX IF NOT EXISTS idx_magazines_organization_id
  ON public.magazines (organization_id);

CREATE INDEX IF NOT EXISTS idx_magazines_template_id
  ON public.magazines (template_id);

CREATE INDEX IF NOT EXISTS idx_markup_configurations_created_by
  ON public.markup_configurations (created_by);

CREATE INDEX IF NOT EXISTS idx_markup_configurations_organization_id
  ON public.markup_configurations (organization_id);

CREATE INDEX IF NOT EXISTS idx_markup_configurations_product_id
  ON public.markup_configurations (product_id);

CREATE INDEX IF NOT EXISTS idx_markup_configurations_supplier_id
  ON public.markup_configurations (supplier_id);

CREATE INDEX IF NOT EXISTS idx_material_equivalences_promo_group_id
  ON public.material_equivalences (promo_group_id);

CREATE INDEX IF NOT EXISTS idx_material_variations_type_id
  ON public.material_variations (type_id);

CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_rotated_from
  ON public.mcp_api_keys (rotated_from);

CREATE INDEX IF NOT EXISTS idx_mcp_key_auto_revocations_key_id
  ON public.mcp_key_auto_revocations (key_id);

CREATE INDEX IF NOT EXISTS idx_mockup_approval_links_job_id
  ON public.mockup_approval_links (job_id);

CREATE INDEX IF NOT EXISTS idx_mockup_credit_txns_credit_account_id
  ON public.mockup_credit_transactions (credit_account_id);

CREATE INDEX IF NOT EXISTS idx_mockup_credit_txns_job_id
  ON public.mockup_credit_transactions (job_id);

CREATE INDEX IF NOT EXISTS idx_mockup_credit_txns_mockup_id
  ON public.mockup_credit_transactions (mockup_id);

CREATE INDEX IF NOT EXISTS idx_mockup_credit_txns_user_id
  ON public.mockup_credit_transactions (user_id);

CREATE INDEX IF NOT EXISTS idx_mockup_generation_jobs_technique_id
  ON public.mockup_generation_jobs (technique_id);

CREATE INDEX IF NOT EXISTS idx_mockup_generation_jobs_user_id
  ON public.mockup_generation_jobs (user_id);

CREATE INDEX IF NOT EXISTS idx_mockup_templates_default_technique_id
  ON public.mockup_templates (default_technique_id);

-- ── N ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_navigation_analytics_user_id
  ON public.navigation_analytics (user_id);

-- ── O ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_optimization_queue_runs_queue_id
  ON public.optimization_queue_runs (queue_id);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_orders_created_by
  ON public.orders (created_by);

CREATE INDEX IF NOT EXISTS idx_orders_seller_id
  ON public.orders (seller_id);

-- ── P ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_packagings_packaging_type_id
  ON public.packagings (packaging_type_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_reviewed_by
  ON public.password_reset_requests (reviewed_by);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user_id
  ON public.password_reset_requests (user_id);

CREATE INDEX IF NOT EXISTS idx_personalization_simulations_seller_id
  ON public.personalization_simulations (seller_id);

CREATE INDEX IF NOT EXISTS idx_pipeline_known_issues_supplier_id
  ON public.pipeline_known_issues (supplier_id);

CREATE INDEX IF NOT EXISTS idx_price_history_changed_by
  ON public.price_history (changed_by);

CREATE INDEX IF NOT EXISTS idx_prod_comp_loc_techs_technique_id
  ON public.product_component_location_techniques (technique_id);

CREATE INDEX IF NOT EXISTS idx_product_deactivation_req_approved_by
  ON public.product_deactivation_requests (approved_by);

CREATE INDEX IF NOT EXISTS idx_product_deactivation_req_rejected_by
  ON public.product_deactivation_requests (rejected_by);

CREATE INDEX IF NOT EXISTS idx_product_deactivation_req_requested_by
  ON public.product_deactivation_requests (requested_by);

CREATE INDEX IF NOT EXISTS idx_product_deactivation_req_supplier_id
  ON public.product_deactivation_requests (supplier_id);

CREATE INDEX IF NOT EXISTS idx_product_deactivation_tokens_request_id
  ON public.product_deactivation_tokens (request_id);

CREATE INDEX IF NOT EXISTS idx_product_faqs_category_id
  ON public.product_faqs (category_id);

CREATE INDEX IF NOT EXISTS idx_product_faqs_product_id
  ON public.product_faqs (product_id);

CREATE INDEX IF NOT EXISTS idx_product_fiscal_ncm_id
  ON public.product_fiscal (ncm_id);

CREATE INDEX IF NOT EXISTS idx_prod_grp_loc_techs_technique_id
  ON public.product_group_location_techniques (technique_id);

CREATE INDEX IF NOT EXISTS idx_product_group_members_product_group_id
  ON public.product_group_members (product_group_id);

CREATE INDEX IF NOT EXISTS idx_product_kit_components_padronizacao_id
  ON public.product_kit_components (padronizacao_id);

CREATE INDEX IF NOT EXISTS idx_product_notebook_specs_binding_color_id
  ON public.product_notebook_specs (binding_color_id);

CREATE INDEX IF NOT EXISTS idx_product_notebook_specs_binding_type_id
  ON public.product_notebook_specs (binding_type_id);

CREATE INDEX IF NOT EXISTS idx_product_notebook_specs_cover_finish_id
  ON public.product_notebook_specs (cover_finish_id);

CREATE INDEX IF NOT EXISTS idx_product_notebook_specs_cover_type_id
  ON public.product_notebook_specs (cover_type_id);

CREATE INDEX IF NOT EXISTS idx_product_notebook_specs_paper_color_id
  ON public.product_notebook_specs (paper_color_id);

CREATE INDEX IF NOT EXISTS idx_product_notebook_specs_paper_format_id
  ON public.product_notebook_specs (paper_format_id);

CREATE INDEX IF NOT EXISTS idx_product_notebook_specs_paper_ruling_id
  ON public.product_notebook_specs (paper_ruling_id);

CREATE INDEX IF NOT EXISTS idx_product_notebook_specs_paper_weight_id
  ON public.product_notebook_specs (paper_weight_id);

CREATE INDEX IF NOT EXISTS idx_product_novelties_created_by
  ON public.product_novelties (created_by);

CREATE INDEX IF NOT EXISTS idx_product_packagings_packaging_id
  ON public.product_packagings (packaging_id);

CREATE INDEX IF NOT EXISTS idx_prod_price_freshness_updated_by
  ON public.product_price_freshness_overrides (updated_by);

CREATE INDEX IF NOT EXISTS idx_prod_similarity_group_members_supplier_id
  ON public.product_similarity_group_members (supplier_id);

CREATE INDEX IF NOT EXISTS idx_product_target_audiences_category_id
  ON public.product_target_audiences (category_id);

CREATE INDEX IF NOT EXISTS idx_product_target_audiences_ta_id
  ON public.product_target_audiences (target_audience_id);

CREATE INDEX IF NOT EXISTS idx_product_videos_video_type_id
  ON public.product_videos (video_type_id);

CREATE INDEX IF NOT EXISTS idx_produtos_padronizacao_sub_brand_id
  ON public.produtos_padronizacao (sub_brand_id);

CREATE INDEX IF NOT EXISTS idx_produtos_site_padronizacao_raw_id
  ON public.produtos_site_padronizacao (raw_id);

CREATE INDEX IF NOT EXISTS idx_profiles_organization_id
  ON public.profiles (organization_id);

-- ── Q ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_quote_approval_tokens_seller_id
  ON public.quote_approval_tokens (seller_id);

CREATE INDEX IF NOT EXISTS idx_quote_history_user_id
  ON public.quote_history (user_id);

CREATE INDEX IF NOT EXISTS idx_quote_items_selected_packaging_id
  ON public.quote_items (selected_packaging_id);

CREATE INDEX IF NOT EXISTS idx_quote_templates_created_by
  ON public.quote_templates (created_by);

CREATE INDEX IF NOT EXISTS idx_quote_versions_created_by
  ON public.quote_versions (created_by);

CREATE INDEX IF NOT EXISTS idx_quotes_assigned_to
  ON public.quotes (assigned_to);

CREATE INDEX IF NOT EXISTS idx_quotes_created_by
  ON public.quotes (created_by);

-- ── R ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_code
  ON public.role_permissions (permission_code);

-- ── S ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sales_goals_user_id
  ON public.sales_goals (user_id);

CREATE INDEX IF NOT EXISTS idx_search_queries_clicked_product_id
  ON public.search_queries (clicked_product_id);

CREATE INDEX IF NOT EXISTS idx_secret_rotation_log_rotated_by
  ON public.secret_rotation_log (rotated_by);

CREATE INDEX IF NOT EXISTS idx_seller_carts_seller_id
  ON public.seller_carts (seller_id);

CREATE INDEX IF NOT EXISTS idx_seller_discount_limits_set_by
  ON public.seller_discount_limits (set_by);

CREATE INDEX IF NOT EXISTS idx_stock_daily_summary_supplier_branch_id
  ON public.stock_daily_summary (supplier_branch_id);

CREATE INDEX IF NOT EXISTS idx_stock_snapshots_supplier_branch_id
  ON public.stock_snapshots (supplier_branch_id);

CREATE INDEX IF NOT EXISTS idx_supplier_attribute_defs_organization_id
  ON public.supplier_attribute_definitions (organization_id);

CREATE INDEX IF NOT EXISTS idx_supplier_category_mappings_category_id
  ON public.supplier_category_mappings (category_id);

CREATE INDEX IF NOT EXISTS idx_supplier_customization_raw_import_batch_id
  ON public.supplier_customization_raw (import_batch_id);

CREATE INDEX IF NOT EXISTS idx_supplier_field_priority_supplier_id
  ON public.supplier_field_priority (supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_packagings_packaging_id
  ON public.supplier_packagings (packaging_id);

CREATE INDEX IF NOT EXISTS idx_supplier_property_mappings_supplier_id
  ON public.supplier_property_mappings (supplier_id);

CREATE INDEX IF NOT EXISTS idx_system_kill_switches_updated_by
  ON public.system_kill_switches (updated_by);

-- ── T ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_target_audiences_organization_id
  ON public.target_audiences (organization_id);

-- ── U ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_allowed_ips_created_by
  ON public.user_allowed_ips (created_by);

CREATE INDEX IF NOT EXISTS idx_user_favorites_product_id
  ON public.user_favorites (product_id);

CREATE INDEX IF NOT EXISTS idx_user_ip_allowlist_created_by
  ON public.user_ip_allowlist (created_by);

CREATE INDEX IF NOT EXISTS idx_user_known_devices_user_id
  ON public.user_known_devices (user_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_granted_by
  ON public.user_roles (granted_by);

-- ── V ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_variant_comdate_commemorative_date_id
  ON public.variant_commemorative_dates (commemorative_date_id);

CREATE INDEX IF NOT EXISTS idx_variant_commemorative_dates_variant_id
  ON public.variant_commemorative_dates (variant_id);

CREATE INDEX IF NOT EXISTS idx_variant_supplier_sources_supplier_branch_id
  ON public.variant_supplier_sources (supplier_branch_id);

CREATE INDEX IF NOT EXISTS idx_visual_search_feedback_user_id
  ON public.visual_search_feedback (user_id);

-- ── W ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id
  ON public.webhook_deliveries (webhook_id);

-- ── Validation ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  found_count int;
  expected    int := 157;
BEGIN
  SELECT COUNT(*) INTO found_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN (
      'idx_admin_settings_updated_by',
      'idx_ai_function_routing_primary_model_id',
      'idx_ai_function_routing_updated_by',
      'idx_ai_providers_created_by',
      'idx_ai_providers_updated_by',
      'idx_ai_routing_decisions_final_model_id',
      'idx_ai_routing_decisions_final_provider_id',
      'idx_ai_routing_decisions_user_id',
      'idx_ai_usage_logs_user_id',
      'idx_attribute_definitions_group_id',
      'idx_attribute_equivalences_verified_by',
      'idx_audit_log_user_id',
      'idx_b2b_collections_created_by',
      'idx_b2b_collections_organization_id',
      'idx_catalog_analytics_user_id',
      'idx_catacccat_accessory_category_id',
      'idx_catcomdate_commemorative_date_id',
      'idx_category_target_audiences_ta_id',
      'idx_collection_products_product_id',
      'idx_color_synonym_map_canonical_color_id',
      'idx_color_variations_color_group_id',
      'idx_color_variations_nuance_id',
      'idx_commemorative_date_colors_color_group_id',
      'idx_comdate_exclusions_comdate_id',
      'idx_commemorative_date_exclusions_product_id',
      'idx_commemorative_date_exclusions_variant_id',
      'idx_commemorative_dates_organization_id',
      'idx_connection_test_history_connection_id',
      'idx_content_articles_author_id',
      'idx_device_login_notifications_user_id',
      'idx_discount_approval_audit_actor_id',
      'idx_discount_approval_requests_admin_id',
      'idx_discount_approval_requests_seller_id',
      'idx_edge_function_invocations_invoked_by',
      'idx_enrichment_log_contact_id',
      'idx_favorite_item_reactions_list_id',
      'idx_file_scan_logs_user_id',
      'idx_frontend_telemetry_user_id',
      'idx_generated_mockups_approved_by_user_id',
      'idx_generated_mockups_job_id',
      'idx_generated_mockups_technique_id',
      'idx_geo_allowed_countries_created_by',
      'idx_inbound_webhook_endpoints_created_by',
      'idx_included_packaging_techs_technique_id',
      'idx_integration_credentials_created_by',
      'idx_integration_credentials_updated_by',
      'idx_ip_access_control_created_by',
      'idx_kit_comments_kit_id',
      'idx_kit_comments_parent_id',
      'idx_kit_component_enrichment_raw_imported_by',
      'idx_kcer_promoted_component_id',
      'idx_kcer_promoted_padronizacao_id',
      'idx_kcpad_component_type_code',
      'idx_kcpad_pkg_type_code',
      'idx_kcpad_raw_id',
      'idx_kcpad_reviewed_by',
      'idx_kit_component_variant_skus_item_color_id',
      'idx_kit_share_tokens_kit_id',
      'idx_kit_templates_created_by',
      'idx_kit_variants_kit_master_id',
      'idx_magazine_pub_view_events_magazine_id',
      'idx_magazine_reader_state_user_id',
      'idx_magazine_templates_organization_id',
      'idx_magazine_templates_owner_id',
      'idx_magazine_templates_template_id',
      'idx_magazines_organization_id',
      'idx_magazines_template_id',
      'idx_markup_configurations_created_by',
      'idx_markup_configurations_organization_id',
      'idx_markup_configurations_product_id',
      'idx_markup_configurations_supplier_id',
      'idx_material_equivalences_promo_group_id',
      'idx_material_variations_type_id',
      'idx_mcp_api_keys_rotated_from',
      'idx_mcp_key_auto_revocations_key_id',
      'idx_mockup_approval_links_job_id',
      'idx_mockup_credit_txns_credit_account_id',
      'idx_mockup_credit_txns_job_id',
      'idx_mockup_credit_txns_mockup_id',
      'idx_mockup_credit_txns_user_id',
      'idx_mockup_generation_jobs_technique_id',
      'idx_mockup_generation_jobs_user_id',
      'idx_mockup_templates_default_technique_id',
      'idx_navigation_analytics_user_id',
      'idx_optimization_queue_runs_queue_id',
      'idx_order_items_order_id',
      'idx_orders_created_by',
      'idx_orders_seller_id',
      'idx_packagings_packaging_type_id',
      'idx_password_reset_requests_reviewed_by',
      'idx_password_reset_requests_user_id',
      'idx_personalization_simulations_seller_id',
      'idx_pipeline_known_issues_supplier_id',
      'idx_price_history_changed_by',
      'idx_prod_comp_loc_techs_technique_id',
      'idx_product_deactivation_req_approved_by',
      'idx_product_deactivation_req_rejected_by',
      'idx_product_deactivation_req_requested_by',
      'idx_product_deactivation_req_supplier_id',
      'idx_product_deactivation_tokens_request_id',
      'idx_product_faqs_category_id',
      'idx_product_faqs_product_id',
      'idx_product_fiscal_ncm_id',
      'idx_prod_grp_loc_techs_technique_id',
      'idx_product_group_members_product_group_id',
      'idx_product_kit_components_padronizacao_id',
      'idx_product_notebook_specs_binding_color_id',
      'idx_product_notebook_specs_binding_type_id',
      'idx_product_notebook_specs_cover_finish_id',
      'idx_product_notebook_specs_cover_type_id',
      'idx_product_notebook_specs_paper_color_id',
      'idx_product_notebook_specs_paper_format_id',
      'idx_product_notebook_specs_paper_ruling_id',
      'idx_product_notebook_specs_paper_weight_id',
      'idx_product_novelties_created_by',
      'idx_product_packagings_packaging_id',
      'idx_prod_price_freshness_updated_by',
      'idx_prod_similarity_group_members_supplier_id',
      'idx_product_target_audiences_category_id',
      'idx_product_target_audiences_ta_id',
      'idx_product_videos_video_type_id',
      'idx_produtos_padronizacao_sub_brand_id',
      'idx_produtos_site_padronizacao_raw_id',
      'idx_profiles_organization_id',
      'idx_quote_approval_tokens_seller_id',
      'idx_quote_history_user_id',
      'idx_quote_items_selected_packaging_id',
      'idx_quote_templates_created_by',
      'idx_quote_versions_created_by',
      'idx_quotes_assigned_to',
      'idx_quotes_created_by',
      'idx_role_permissions_permission_code',
      'idx_sales_goals_user_id',
      'idx_search_queries_clicked_product_id',
      'idx_secret_rotation_log_rotated_by',
      'idx_seller_carts_seller_id',
      'idx_seller_discount_limits_set_by',
      'idx_stock_daily_summary_supplier_branch_id',
      'idx_stock_snapshots_supplier_branch_id',
      'idx_supplier_attribute_defs_organization_id',
      'idx_supplier_category_mappings_category_id',
      'idx_supplier_customization_raw_import_batch_id',
      'idx_supplier_field_priority_supplier_id',
      'idx_supplier_packagings_packaging_id',
      'idx_supplier_property_mappings_supplier_id',
      'idx_system_kill_switches_updated_by',
      'idx_target_audiences_organization_id',
      'idx_user_allowed_ips_created_by',
      'idx_user_favorites_product_id',
      'idx_user_ip_allowlist_created_by',
      'idx_user_known_devices_user_id',
      'idx_user_roles_granted_by',
      'idx_variant_comdate_commemorative_date_id',
      'idx_variant_commemorative_dates_variant_id',
      'idx_variant_supplier_sources_supplier_branch_id',
      'idx_visual_search_feedback_user_id',
      'idx_webhook_deliveries_webhook_id'
    );

  RAISE NOTICE '✓ Migration 037: %/% FK covering indexes found in pg_indexes',
    found_count, expected;

  IF found_count < expected THEN
    RAISE WARNING 'Only % of % indexes confirmed — check pg_indexes for missing entries',
      found_count, expected;
  ELSE
    RAISE NOTICE '✓ All 157 FK covering indexes created — 162 unindexed_foreign_keys findings addressed';
  END IF;

  RAISE NOTICE 'Migration 037 complete.';
END;
$$;
