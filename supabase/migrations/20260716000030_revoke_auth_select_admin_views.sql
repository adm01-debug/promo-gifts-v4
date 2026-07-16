-- Migration 030: Revoke authenticated SELECT from admin-only views
--
-- Source: 200-commit audit + get_advisors post-029 analysis
-- Target finding: pg_graphql_authenticated_table_exposed (561 findings)
--
-- These views are flagged because any authenticated user (not just admins)
-- can query them via GraphQL / PostgREST. All objects below are confirmed
-- to have ZERO legitimate regular-user need:
--   - Supplier pipeline views (vw_asia_*, vw_xbz_*, vw_spot_*, vw_somarcas_*)
--     → internal import dashboards, only used by service_role cron + admin portal
--   - Supplier admin views (vw_supplier_*)
--     → admin configuration panels only
--   - System / health / QA views (v_db_health_*, vw_system_*, vw_medallion_*, etc.)
--     → internal monitoring dashboards
--   - AI / enrichment admin views (vw_ai_*, vw_products_ai_*)
--     → internal AI pipeline admin
--   - Image / media QA views (vw_duplicate_images, vw_product_images_health, etc.)
--     → admin QA tools
--   - Pipeline / progress / audit views (v_pipeline_*, v_audit_*, v_smoke_tests_*)
--     → admin dashboards
--   - SEO / rupture / stock admin views
--     → admin reporting only
--
-- Objects intentionally KEPT authenticated-accessible (not touched here):
--   - v_products_public, v_suppliers_public, v_tags_public — public catalog
--   - v_catalog_stats, v_media_stats, v_super_filtro_options — catalog
--   - v_product_images_cdn, v_product_videos_cdn, v_product_videos_ready — catalog
--   - v_*_public views — explicitly public catalog surface
--   - v_kit_*, v_products_complete, v_products_kit_builder — kit builder / product detail
--   - vw_product_*, vw_packagings_*, vw_products_with_properties — product catalog
--   - vw_novelties_*, vw_product_novelties_active — home page novelties
--   - vw_sitemap_* — public sitemap (anon + authenticated)
--   - categories_tree_visual, v_category_keywords — category navigation
--   - v_commemorative_dates_* — dates catalog
--   - vw_variant_sale_prices, v_variant_sale_prices_public — pricing
--   - v_my_markup_config, v_quote_seller_kpis — seller-specific
--   - bi_quotes_summary — seller analytics
--   - v_stock_by_product, v_stock_velocity_safe, v_price_history_safe — product data
--   - somarcas_catalogo_publico, materials_complete, products_with_materials — catalog
--   - v_color_nuances_public — color catalog
--   - v_images_by_product, v_products_with_tags — product media/tags
--
-- Safety: IF EXISTS guard via pg_class / pg_views check. REVOKE on non-existent
--         privilege is a no-op. REVOKE on non-existent object would error,
--         hence the existence check pattern.

DO $$
DECLARE
  obj text;

  -- A) Internal pipeline / supplier views (vw_asia_*, vw_xbz_*, vw_spot_*, vw_somarcas_*)
  supplier_pipeline_views text[] := ARRAY[
    -- ASIA supplier pipeline
    'vw_asia_products_by_category',
    'vw_asia_products_by_color',
    'vw_asia_products_by_tag',
    'vw_asia_products_errors',
    'vw_asia_products_low_stock',
    'vw_asia_products_pending',
    'vw_asia_products_promo',
    'vw_asia_products_stats',
    -- XBZ supplier pipeline
    'vw_xbz_products_by_category',
    'vw_xbz_products_by_color',
    'vw_xbz_products_stats',
    'vw_xbz_produtos_sem_imagem',
    'vw_xbz_scraping_status',
    -- SPOT supplier
    'vw_spot_cf_health',
    'vw_spot_color_health',
    'vw_spot_color_separator_reference',
    'vw_spot_image_coverage',
    'vw_spot_price_alerts',
    -- Somarcas
    'vw_somarcas_pending',
    'vw_somarcas_stats',
    'vw_somarcas_sync_status',
    'vw_somarcas_materials'
  ];

  -- B) Supplier admin / mapping views
  supplier_admin_views text[] := ARRAY[
    'vw_supplier_category_coverage',
    'vw_supplier_color_mappings',
    'vw_supplier_field_mappings_summary',
    'vw_supplier_mapping_statistics',
    'vw_supplier_products_raw_errors',
    'vw_supplier_products_raw_status'
  ];

  -- C) System / health / monitoring views
  system_health_views text[] := ARRAY[
    'vw_system_health_quick',
    'vw_medallion_coverage',
    'vw_super_filtro_health',
    'vw_classify_functions_status',
    'v_connection_health',
    'v_crm_callback_health',
    'v_db_health_audit',
    'v_db_health_check',
    'v_smoke_tests_latest_run',
    'v_smoke_tests_trend',
    'v_webhook_delivery_stats',
    'v_kill_switch_hits_summary',
    'v_monthly_costs',
    'ai_insights_cache',
    'v_ai_function_routing_effective'
  ];

  -- D) AI / enrichment admin views
  ai_admin_views text[] := ARRAY[
    'vw_ai_enrichment_status',
    'vw_ai_history_stats',
    'vw_products_ai_status',
    'v_enrichment_stats',
    'v_needs_enrichment'
  ];

  -- E) Image / media QA admin views
  image_qa_views text[] := ARRAY[
    'vw_active_products_missing_gold_images',
    'vw_duplicate_images',
    'vw_image_type_coherence',
    'vw_images_pending_dimensions',
    'vw_product_images_health',
    'vw_product_images_variant_gap',
    'vw_qa_products_missing_images',
    'vw_media_stats_by_type',
    'v_audit_paradoxos_gravacao',
    'v_blurhash_coverage',
    'v_blurhash_summary',
    'v_gravacao_cobertura',
    'v_image_quality_stats',
    'v_media_statistics',
    'v_product_image_hash_duplicates',
    'v_unmapped_images',
    'v_dimensions_source_divergence'
  ];

  -- F) Pipeline / progress / audit admin views
  pipeline_audit_views text[] := ARRAY[
    'v_pipeline_next_step',
    'v_pipeline_progress',
    'v_products_ai_coverage',
    'v_products_dimensions_audit',
    'v_products_images_summary',
    'v_products_missing_primary_image',
    'v_products_name_audit',
    'v_products_pending_images',
    'v_products_public_test',
    'v_products_without_images',
    'v_products_without_video',
    'v_product_tokens',
    'v_video_dashboard',
    'v_video_validation_recent',
    'v_videos_pending',
    'v_xbz_ficha_parse_queue',
    'v_color_coverage_monitor'
  ];

  -- G) Kit completeness / enrichment admin views
  kit_admin_views text[] := ARRAY[
    'v_kit_completeness_by_supplier',
    'v_kit_component_completeness',
    'v_kit_component_identity_health',
    'v_kit_enrichment_dashboard',
    'v_kit_ficha_pipeline_health',
    'v_kit_pipeline_health'
  ];

  -- H) Product / SEO / rupture / stock admin views
  product_admin_views text[] := ARRAY[
    'vw_products_pending_variants',
    'vw_products_seo_status',
    'vw_products_by_date',
    'vw_products_by_property_category',
    'vw_products_thermal_status',
    'vw_thermal_products',
    'vw_property_statistics',
    'vw_source_channel_coverage',
    'vw_component_types_usage',
    'vw_novelty_health',
    'vw_material_health',
    'vw_packaging_health',
    'vw_packaging_suppliers',
    'vw_color_coverage',
    'vw_color_mapping',
    'vw_category_accessories',
    'vw_category_commemorative_dates',
    'vw_category_mapping_gaps',
    'vw_category_target_audiences',
    'vw_category_variation_types',
    'vw_category_completeness',
    'vw_seo_dashboard',
    'vw_produtos_sem_ncm',
    'vw_rupture_confidence_audit',
    'vw_rupture_gap_purchase',
    'vw_rupture_live_divergence',
    'v_blurhash_summary'
  ];

BEGIN
  -- Process all view groups
  FOREACH obj IN ARRAY (
    supplier_pipeline_views || supplier_admin_views || system_health_views ||
    ai_admin_views || image_qa_views || pipeline_audit_views ||
    kit_admin_views || product_admin_views
  ) LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = obj
        AND c.relkind IN ('v', 'm')
    ) THEN
      EXECUTE format('REVOKE SELECT ON public.%I FROM authenticated', obj);
      RAISE NOTICE '✓ REVOKE SELECT ON public.% FROM authenticated', obj;
    ELSE
      RAISE NOTICE '- public.% not found (view/mv) — skipping', obj;
    END IF;
  END LOOP;

  RAISE NOTICE 'Done: authenticated SELECT revoked from admin-only views.';
END;
$$;

-- ─── Validation ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  obj text;
  still_exposed text[] := ARRAY[]::text[];
  sample text[] := ARRAY[
    'vw_asia_products_stats',
    'vw_supplier_mapping_statistics',
    'vw_system_health_quick',
    'v_pipeline_progress',
    'v_db_health_check',
    'vw_rupture_live_divergence',
    'v_kit_pipeline_health',
    'vw_ai_enrichment_status'
  ];
  has_select boolean;
BEGIN
  FOREACH obj IN ARRAY sample LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = obj
        AND grantee = 'authenticated'
        AND privilege_type = 'SELECT'
    ) INTO has_select;
    IF has_select THEN
      still_exposed := still_exposed || obj;
    END IF;
  END LOOP;

  IF array_length(still_exposed, 1) > 0 THEN
    RAISE WARNING 'authenticated SELECT still present on: %', array_to_string(still_exposed, ', ');
  ELSE
    RAISE NOTICE '✓ Validation OK: sample admin views no longer expose SELECT to authenticated';
  END IF;

  RAISE NOTICE 'Migration 030 complete.';
END;
$$;
