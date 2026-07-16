-- Migration 029: Revoke authenticated SELECT from admin MVs +
--               Revoke EXECUTE from pipeline SECURITY DEFINER functions
--
-- Source: 200-commit audit + Supabase advisor get_advisors (security) post-028
--
-- Part A — Admin / internal materialized views
--   These 5 MVs are in pg_graphql_authenticated_table_exposed and/or
--   materialized_view_in_api but have no legitimate authenticated-user need:
--     mv_ema_kpi_by_level     — EMA KPI analytics (cron-generated, admin only)
--     mv_stock_rupture_alert  — Stock rupture alerts (admin dashboard)
--     mv_supplier_reliability — Supplier reliability analytics (admin only)
--     mv_material_group_stats — Material group coverage stats (admin only)
--     mv_media_health         — Media health snapshot (admin only)
--   Result: eliminates their pg_graphql_authenticated_table_exposed entries,
--   and removes mv_ema_kpi_by_level / mv_stock_rupture_alert / mv_supplier_reliability
--   from materialized_view_in_api (leaving only mv_product_leaf_category which is
--   intentional public catalog data).
--
-- Part B — SECURITY DEFINER pipeline functions
--   160 functions that are exclusively called by:
--     - cron jobs running as service_role
--     - edge functions with service_role JWT
--   None are called via supabase.rpc() from the React frontend (confirmed
--   via grep of src/ — all frontend RPCs use the whitelisted fn_global_search,
--   fn_super_filtro_*, fn_get_product_*, get_profile_and_roles, etc.).
--
--   Categories:
--     fn_asia_*  — ASIA supplier image/video/stock import pipeline
--     fn_xbz_*   — XBZ supplier import & image pipeline
--     fn_spot_*  — SPOT supplier import, video, color, stock pipeline
--     fn_sm_*    — Somarcas (SM) supplier pipeline
--     fn_cf_*    — Cloudflare image pipeline helpers
--     fn_pipeline_*, fn_ingestion_*, fn_ingest_* — generic pipeline ops
--     fn_sync_*  — data sync operations
--     fn_promote_* — Bronze→Silver→Gold promotion
--     fn_backfill_*, fn_recover*, fn_rebuild_*, fn_repair_* — maintenance
--     fn_cron_*, fn_run_* — cron job helpers
--     fn_enqueue_*, fn_dequeue_*, fn_dispatch*, fn_harvest* — queue ops
--     fn_auto_*  — automated grouping/similarity
--     fn_alert_* — internal pipeline alerts
--     fn_apply_* — data application ops
--     fn_bulk_*, fn_bronze_*, fn_process_* — batch processing
--     fn_aggregate_*, fn_populate_*, fn_expire_* — maintenance ops
--     fn_reconcile_*, fn_refresh_*, fn_resync_*, fn_snapshot_* — refresh ops
--     fn_link_*  — data linking ops
--
--   Fix: REVOKE EXECUTE FROM PUBLIC, anon, authenticated;
--        GRANT EXECUTE TO service_role;  (makes intent explicit)
--
--   Approach: pg_proc lookup by proname to handle any signature overloads.
--   A function not found in pg_proc → RAISE NOTICE, skip (no error).
--
-- Intentionally NOT touched (kept anon/authenticated EXECUTE):
--   fn_global_search, fn_super_filtro_*, fn_get_product_*, fn_rpc_exists,
--   fn_log_search_analytics, fn_get_category_breadcrumb, fn_get_color_swatches_batch,
--   fn_get_customization_price, fn_get_product_intelligence_all, fn_get_similar_products,
--   check_login_rate_limit, fn_check_login_allowed, fn_notify_user,
--   get_profile_and_roles, restore_seller_cart, fn_batch_update_cart_item_sort_order,
--   fn_get_discontinued_products, fn_request_product_deactivation,
--   fn_approve_product_deactivation, fn_reject_product_deactivation,
--   fn_get_reposicao_listing, fn_rupture_quick_stats, fn_rupture_by_level,
--   is_admin_or_above, is_coord_or_above, is_dnd_active, is_org_member,
--   is_org_owner_or_admin, org_has_any_members, user_is_org_member,
--   start_step_up_challenge, verify_step_up_password, can_access_quote,
--   restore_collection_item_from_trash, get_favorite_list_counts, etc.

-- ─── Part A: Admin materialized views ────────────────────────────────────────
DO $$
DECLARE
  obj text;
  admin_mvs text[] := ARRAY[
    'mv_ema_kpi_by_level',
    'mv_stock_rupture_alert',
    'mv_supplier_reliability',
    'mv_material_group_stats',
    'mv_media_health'
  ];
BEGIN
  FOREACH obj IN ARRAY admin_mvs LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = obj AND c.relkind = 'm'
    ) THEN
      EXECUTE format('REVOKE SELECT ON public.%I FROM anon', obj);
      EXECUTE format('REVOKE SELECT ON public.%I FROM authenticated', obj);
      RAISE NOTICE '✓ REVOKE SELECT ON public.% FROM anon, authenticated', obj;
    ELSE
      RAISE NOTICE '- public.% not found (matview) — skipping', obj;
    END IF;
  END LOOP;
  RAISE NOTICE 'Part A done: admin materialized views processed.';
END;
$$;

-- ─── Part B: Internal pipeline SECURITY DEFINER functions ────────────────────
DO $$
DECLARE
  r RECORD;
  fn_name text;

  -- fn_asia_* — ASIA supplier image/video/stock pipeline
  asia_fns text[] := ARRAY[
    'fn_asia_complete_image_upload',
    'fn_asia_complete_image_upload_batch',
    'fn_asia_dispatch_queue_batch',
    'fn_asia_enqueue_primary_url_images',
    'fn_asia_enqueue_videos',
    'fn_asia_find_not_found',
    'fn_asia_fix_multi_main_images',
    'fn_asia_harvest_queue_batch',
    'fn_asia_import_youtube_videos',
    'fn_asia_ingest_all_pages',
    'fn_asia_legacy_dispatch_batch',
    'fn_asia_legacy_harvest_batch',
    'fn_asia_legacy_run_cycle',
    'fn_asia_link_video',
    'fn_asia_mark_upload_error',
    'fn_asia_monitor_variants',
    'fn_asia_populate_image_queue',
    'fn_asia_recover_stale_queue',
    'fn_asia_run_image_cycle',
    'fn_asia_stock_fast_sync'
  ];

  -- fn_xbz_* — XBZ supplier pipeline
  xbz_fns text[] := ARRAY[
    'fn_xbz_dispatch_image_batch',
    'fn_xbz_enqueue_videos',
    'fn_xbz_enrich_stock_batch',
    'fn_xbz_ficha_run_batch',
    'fn_xbz_harvest_image_batch',
    'fn_xbz_link_images_to_colors',
    'fn_xbz_link_video',
    'fn_xbz_populate_images_from_site',
    'fn_xbz_populate_videos_from_site',
    'fn_xbz_recover_stale',
    'fn_xbz_run_image_cycle',
    'fn_xbz_site_enqueue',
    'fn_xbz_stock_fast_sync',
    'fn_xbz_stock_fast_sync_v2',
    'fn_xbz_stock_fast_sync_v3'
  ];

  -- fn_spot_* — SPOT supplier pipeline
  spot_fns text[] := ARRAY[
    'fn_spot_color_integrity_check',
    'fn_spot_customization_prices_to_gold',
    'fn_spot_detect_new_images',
    'fn_spot_direct_prices_gold',
    'fn_spot_direct_stock_gold',
    'fn_spot_enqueue_new_videos',
    'fn_spot_enqueue_vimeo_eu',
    'fn_spot_enrich_image_colors',
    'fn_spot_eu_diff_get_refs',
    'fn_spot_fix_materials',
    'fn_spot_gold_enrich',
    'fn_spot_health_check',
    'fn_spot_link_video',
    'fn_spot_print_positions',
    'fn_spot_process_batch',
    'fn_spot_process_ref',
    'fn_spot_reconcile_variant_to_legacy',
    'fn_spot_relink_family_images',
    'fn_spot_silver_enrich',
    'fn_spot_stock_fast_sync',
    'fn_spot_variant_repl_enrich',
    'fn_spot_vimeo_daily_sync'
  ];

  -- fn_sm_* — Somarcas supplier pipeline
  sm_fns text[] := ARRAY[
    'fn_sm_category_collect',
    'fn_sm_category_enqueue',
    'fn_sm_category_seed',
    'fn_sm_enqueue_videos',
    'fn_sm_link_video',
    'fn_sm_pipeline_health',
    'fn_sm_populate_colors',
    'fn_sm_populate_videos_from_site',
    'fn_sm_promote_videos_from_site',
    'fn_sm_session_check',
    'fn_sm_site_collect',
    'fn_sm_site_enqueue',
    'fn_sm_site_tick',
    'fn_sm_stock_guard',
    'fn_sm_to_silver',
    'fn_sm_url_discover_collect',
    'fn_sm_url_discover_via_search',
    'fn_sm_url_map_build',
    'fn_sm_url_map_from_site_urls',
    'fn_sm_variant_coherence_guard'
  ];

  -- fn_cf_* — Cloudflare pipeline helpers
  cf_fns text[] := ARRAY[
    'fn_cf_collect_sm_legacy_dispatch',
    'fn_cf_collect_sm_legacy_harvest',
    'fn_cf_recon_collect',
    'fn_cf_recon_dispatch',
    'fn_cf_sm_legacy_insert_batch'
  ];

  -- Generic pipeline / ingestion / sync / promote / backfill
  pipeline_fns text[] := ARRAY[
    -- Pipeline ops
    'fn_pipeline_health',
    'fn_pipeline_health_monitor',
    'fn_pipeline_promote_tick',
    'fn_run_pipeline_health_check',
    'fn_run_smoke_tests',
    -- Ingestion
    'fn_ingest_asia_api_batch',
    'fn_ingest_asia_hg_batch',
    'fn_ingest_asia_hg_batch_debug',
    'fn_ingest_asia_hg_debug_sample',
    'fn_ingest_bronze_batch',
    'fn_ingest_colors_batch',
    'fn_ingest_customization_options_batch',
    'fn_ingestion_health',
    'fn_ingestion_run_close',
    'fn_ingestion_run_open',
    -- Sync
    'fn_sync_all_is_new',
    'fn_sync_asia_colors',
    'fn_sync_derived_product_flags',
    'fn_sync_dispatcher_log_from_net',
    'fn_sync_dynamic_collections',
    'fn_sync_is_new_expires_at',
    'fn_sync_is_stockout_all',
    'fn_sync_local_drift_to_schema_drift_log',
    'fn_sync_product_novelties',
    'fn_sync_product_physical_from_products',
    'fn_sync_products_videos_cache',
    'fn_sync_profile_role_from_user_roles',
    'fn_sync_stock_bronze_to_gold',
    'fn_sync_stock_bronze_to_gold_spot',
    -- Promote
    'fn_promote_customization_to_gold',
    'fn_promote_kit_component_padronizacao',
    'fn_promote_kit_ficha_staging',
    'fn_promote_notebook_specs',
    'fn_promote_padronizacao',
    -- Backfill
    'fn_backfill_all_product_tags',
    'fn_backfill_asia_properties',
    'fn_backfill_is_thermal',
    -- Rebuild / repair / reconcile
    'fn_rebuild_category_ancestors',
    'fn_rebuild_color_swatches',
    'fn_repair_canonical_chains',
    'fn_reconcile_category_products_count',
    'fn_reconcile_stock_gold',
    -- Refresh / resync
    'fn_refresh_kit_component_variant_skus',
    'fn_refresh_supplier_sync_timestamps',
    'fn_resync_all_category_counts',
    'fn_resync_product_image_urls',
    'fn_resync_product_media',
    'fn_resync_product_physical_all',
    -- Recover / cron
    'fn_cron_safe_run',
    'fn_cron_watchdog',
    -- Snapshot / aggregate
    'fn_snapshot_medallion_coverage',
    'fn_aggregate_stock_daily',
    -- Enqueue / dequeue
    'fn_enqueue_ai_enrichment',
    'fn_dequeue_ai_enrichment',
    -- Auto / alert
    'fn_auto_similarity_groups_v2',
    'fn_auto_similarity_groups_v3',
    'fn_alert_dispatcher_failures',
    'fn_alert_products_without_images',
    'fn_alert_supplier_settings_incomplete',
    -- Apply (data application ops)
    'fn_apply_auto_tag_rules',
    'fn_apply_crm_callback',
    'fn_apply_print_profiles',
    'fn_apply_supplier_flag_tags',
    -- Bulk / bronze / process
    'fn_bulk_update_image_dimensions',
    'fn_bronze_mark_absent',
    'fn_process_all_kit_component_enrichments',
    'fn_process_asia_stock_pending',
    'fn_process_raw_v2',
    'fn_process_webhook_outbox_batch',
    -- Link ops
    'fn_link_asia_colors_from_bronze',
    'fn_link_cf_image',
    'fn_link_sm_colors_from_title',
    -- Populate ops
    'fn_populate_all_products_seo',
    'fn_populate_novelties_from_supplier',
    -- Expire ops
    'fn_expire_novelties',
    'fn_expire_novelties_with_stats',
    'fn_expire_overdue_quotes',
    'fn_expire_pending_promises',
    -- Enrich ops (pipeline-only)
    'fn_enrich_asia_components_batch',
    'fn_enrich_kits_daily',
    'fn_enrich_pen_categories',
    'fn_enrich_properties_batch',
    -- Misc pipeline
    'fn_is_bulk_import_mode',
    'fn_generate_market_insights_cache',
    'fn_generate_trends_insights',
    'fn_color_link_all_suppliers',
    'fn_upsert_asia_wp_batch',
    'fn_upsert_stock_to_bronze',
    'fn_upsert_stocks_bulk_spot',
    'fn_tag_product_complete',
    'fn_trigger_schema_drift_fetch',
    'fn_update_all_seo_scores',
    'fn_update_image_dimensions',
    'fn_check_rowtype_staleness',
    'fn_assert_public_contract',
    'fn_anon_access_audit',
    'fn_analyze_dictionaries',
    'fn_dryrun_raw_v2',
    'fn_dryrun_standardize_supplier',
    'fn_standardize_kit_component',
    'fn_standardize_supplier',
    'fn_resolve_supplier',
    'fn_match_canonical_color',
    'fn_kit_auto_approve_high_confidence',
    'fn_kit_auto_promote_approved',
    'fn_kit_from_ficha',
    'fn_kit_material_quick_propagate',
    'fn_kit_sync_personalization_notes',
    'fn_decompose_kit_from_ficha',
    'fn_auto_similarity_groups_v2',
    'fn_auto_similarity_groups_v3',
    -- Health checks (internal)
    'fn_health_check_gravacao',
    'fn_product_images_health_check',
    'fn_notebook_specs_health',
    'fn_site_pipeline_health',
    'fn_smoke_tests_categorization',
    -- Warehouse / stock operations (service_role only)
    'fn_get_image_upload_queue',
    'fn_get_spot_feb2026_ids',
    'fn_reactivate_valid_novelties',
    'fn_save_ai_enrichment_results',
    'fn_spr_requeue_failed',
    'fn_recalc_has_optional_packaging',
    -- Internal classification
    'fn_is_graphic_material',
    'classify_xbz_category',
    'calculate_seo_score',
    'check_telemetry_regression',
    -- Internal validation
    'validate_edge_functions_base_url',
    'fn_ema_kpi_by_level',
    -- Internal parsers (not called from frontend)
    'fn_extract_dimensions_from_text',
    'fn_extract_item_dims_xbz_from_bronze',
    'fn_extract_kit_dims_from_somarcas_bronze',
    'fn_extract_kit_dims_from_spot_bronze',
    'fn_extract_kit_dims_from_xbz_bronze',
    'fn_extract_notebook_feature_codes',
    'fn_extract_pkg_dims_from_bronze',
    'fn_fetch_xbz_ficha',
    'fn_parse_binding_color_code',
    'fn_parse_binding_type_code',
    'fn_parse_cover_material_code',
    'fn_parse_cover_type_code',
    'fn_parse_ficha_tecnica_text',
    'fn_parse_kit_page_dimensions',
    'fn_parse_paper_color_code',
    'fn_parse_paper_format',
    'fn_parse_paper_ruling',
    'fn_parse_paper_weight',
    'fn_parse_sheet_count',
    'fn_parse_xbz_ficha_site_batch',
    'fn_get_asia_product_dims_for_kit',
    -- Internal cron/partition ops
    'magazine_ensure_view_event_partitions',
    'process_notifications_queue',
    -- Video pipeline
    'fn_video_link',
    'fn_video_link_to_products',
    'fn_video_queue_next',
    'fn_video_queue_old_uid',
    'fn_video_queue_recover_stuck',
    'fn_video_queue_update',
    'fn_video_retry_errors',
    'fn_video_set_dimensions',
    'fn_video_sim_export',
    'fn_video_sim_upsert',
    -- Rupture/reposicao (pipeline cron)
    'fn_rupture_anomalia_report',
    'fn_rupture_health_check',
    'fn_reposicao_backfill_today',
    -- AI enrichment (service_role cron)
    'fn_ai_quota_summary',
    'rpc_enrich_kit_component'
  ];

BEGIN
  -- Combine all function name lists and process each
  FOR fn_name IN
    SELECT unnest(asia_fns || xbz_fns || spot_fns || sm_fns || cf_fns || pipeline_fns)
  LOOP
    FOR r IN
      SELECT p.oid::regprocedure::text AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn_name
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
      RAISE NOTICE '✓ REVOKE EXECUTE ON FUNCTION % FROM PUBLIC/anon/authenticated', r.sig;
    END LOOP;
    IF NOT FOUND THEN
      RAISE NOTICE '- function % not found in public schema — skipping', fn_name;
    END IF;
  END LOOP;

  RAISE NOTICE 'Part B done: internal pipeline functions processed.';
END;
$$;

-- ─── Validation ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  still_exposed text[] := ARRAY[]::text[];
  obj text;
  has_auth boolean;
  sample_mvs text[] := ARRAY[
    'mv_ema_kpi_by_level',
    'mv_stock_rupture_alert',
    'mv_supplier_reliability'
  ];
BEGIN
  -- Check MVs
  FOREACH obj IN ARRAY sample_mvs LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = obj
        AND grantee IN ('anon', 'authenticated')
        AND privilege_type = 'SELECT'
    ) INTO has_auth;
    IF has_auth THEN
      still_exposed := still_exposed || obj;
    END IF;
  END LOOP;

  IF array_length(still_exposed, 1) > 0 THEN
    RAISE WARNING 'SELECT still present on: %', array_to_string(still_exposed, ', ');
  ELSE
    RAISE NOTICE '✓ Validation OK: admin MVs no longer expose SELECT to anon/authenticated';
  END IF;

  RAISE NOTICE 'Migration 029 complete.';
END;
$$;
