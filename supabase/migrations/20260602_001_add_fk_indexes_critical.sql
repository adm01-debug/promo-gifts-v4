-- ============================================================
-- MIGRATION 001: Adiciona indices em FK sem cobertura
-- Auditoria: 02/06/2026 — Claude Sonnet 4
-- 60 FK identificadas sem indice causando full scans em JOINs
-- ============================================================

-- STOCK SNAPSHOTS (tabela de estoque critica)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_snapshots_variant_id
  ON public.stock_snapshots(variant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_snapshots_supplier_id
  ON public.stock_snapshots(supplier_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_snapshots_supplier_branch_id
  ON public.stock_snapshots(supplier_branch_id);

-- STOCK DAILY SUMMARY
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_daily_summary_variant_id
  ON public.stock_daily_summary(variant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_daily_summary_supplier_id
  ON public.stock_daily_summary(supplier_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_daily_summary_supplier_branch_id
  ON public.stock_daily_summary(supplier_branch_id);

-- ORDER ITEMS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id
  ON public.order_items(order_id);

-- MOCKUP GENERATION JOBS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mockup_generation_jobs_product_id
  ON public.mockup_generation_jobs(product_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mockup_generation_jobs_technique_id
  ON public.mockup_generation_jobs(technique_id);

-- GENERATED MOCKUPS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_mockups_product_id
  ON public.generated_mockups(product_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_mockups_technique_id
  ON public.generated_mockups(technique_id);

-- MOCKUP CREDIT TRANSACTIONS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mockup_credit_transactions_job_id
  ON public.mockup_credit_transactions(job_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mockup_credit_transactions_credit_account_id
  ON public.mockup_credit_transactions(credit_account_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mockup_credit_transactions_mockup_id
  ON public.mockup_credit_transactions(mockup_id);

-- COLOR VARIATIONS (FK para color_groups e color_nuances)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_color_variations_color_group_id
  ON public.color_variations(color_group_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_color_variations_nuance_id
  ON public.color_variations(nuance_id);

-- AI FUNCTION ROUTING
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_function_routing_primary_model_id
  ON public.ai_function_routing(primary_model_id);

-- AI ROUTING DECISIONS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_routing_decisions_final_model_id
  ON public.ai_routing_decisions(final_model_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_routing_decisions_final_provider_id
  ON public.ai_routing_decisions(final_provider_id);

-- MATERIAL VARIATIONS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_material_variations_type_id
  ON public.material_variations(type_id);

-- ATTRIBUTE DEFINITIONS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attribute_definitions_group_id
  ON public.attribute_definitions(group_id);

-- WEBHOOK DELIVERIES
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_deliveries_webhook_id
  ON public.webhook_deliveries(webhook_id);

-- SUPPLIER IMAGE SUFFIX PATTERNS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_supplier_image_suffix_patterns_supplier_id
  ON public.supplier_image_suffix_patterns(supplier_id);

-- SUPPLIER PROPERTY MAPPINGS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_supplier_property_mappings_supplier_id
  ON public.supplier_property_mappings(supplier_id);

-- MARKUP CONFIGURATIONS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_markup_configurations_supplier_id
  ON public.markup_configurations(supplier_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_markup_configurations_product_id
  ON public.markup_configurations(product_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_markup_configurations_created_by
  ON public.markup_configurations(created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_markup_configurations_organization_id
  ON public.markup_configurations(organization_id);

-- PRODUCT FAQS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_faqs_product_id
  ON public.product_faqs(product_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_faqs_category_id
  ON public.product_faqs(category_id);

-- QUOTE COMMENTS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_comments_quote_id
  ON public.quote_comments(quote_id);

-- PACKAGINGS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_packagings_packaging_type_id
  ON public.packagings(packaging_type_id);

-- OPTIMIZATION QUEUE RUNS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_optimization_queue_runs_queue_id
  ON public.optimization_queue_runs(queue_id);

-- PRODUCT GROUP MEMBERS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_group_members_product_group_id
  ON public.product_group_members(product_group_id);

-- PRODUCT TARGET AUDIENCES
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_target_audiences_category_id
  ON public.product_target_audiences(category_id);

-- SCRAPER IMAGES STAGING
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scraper_images_staging_product_id
  ON public.scraper_images_staging(product_id);

-- MEDIA SYNC LOG
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_sync_log_video_id
  ON public.media_sync_log(video_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_sync_log_image_id
  ON public.media_sync_log(image_id);

-- MEDIA SYNC QUEUE
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_sync_queue_supplier_id
  ON public.media_sync_queue(supplier_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_sync_queue_organization_id
  ON public.media_sync_queue(organization_id);

-- KIT SHARE TOKENS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kit_share_tokens_kit_id
  ON public.kit_share_tokens(kit_id);

-- KIT VARIANTS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kit_variants_kit_master_id
  ON public.kit_variants(kit_master_id);

-- KIT COMMENTS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kit_comments_kit_id
  ON public.kit_comments(kit_id);

-- MCP KEY AUTO REVOCATIONS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mcp_key_auto_revocations_key_id
  ON public.mcp_key_auto_revocations(key_id);

-- MCP API KEYS (self-ref)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mcp_api_keys_rotated_from
  ON public.mcp_api_keys(rotated_from)
  WHERE rotated_from IS NOT NULL;

-- QUOTES (self-ref parent_quote_id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quotes_parent_quote_id
  ON public.quotes(parent_quote_id)
  WHERE parent_quote_id IS NOT NULL;

-- PERSONALIZATION SIMULATIONS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_personalization_simulations_product_id
  ON public.personalization_simulations(product_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_personalization_simulations_client_id
  ON public.personalization_simulations(client_id);

-- ENRICHMENT LOG
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrichment_log_contact_id
  ON public.enrichment_log(contact_id);

-- COMMEMORATIVE DATE EXCLUSIONS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_commemorative_date_exclusions_date_id
  ON public.commemorative_date_exclusions(commemorative_date_id);

-- COMMEMORATIVE DATES
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_commemorative_dates_organization_id
  ON public.commemorative_dates(organization_id)
  WHERE organization_id IS NOT NULL;

-- B2B COLLECTIONS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_b2b_collections_organization_id
  ON public.b2b_collections(organization_id);

-- COLOR ANALYSIS STAGING
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_color_analysis_staging_current_variation_id
  ON public.color_analysis_staging(current_variation_id)
  WHERE current_variation_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_color_analysis_staging_suggested_variation_id
  ON public.color_analysis_staging(suggested_variation_id)
  WHERE suggested_variation_id IS NOT NULL;

-- MOCKUP TEMPLATES
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mockup_templates_default_technique_id
  ON public.mockup_templates(default_technique_id)
  WHERE default_technique_id IS NOT NULL;

-- CONNECTION TEST HISTORY
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_connection_test_history_connection_id
  ON public.connection_test_history(connection_id);
