-- Migration: Revoke anon SELECT from internal tables and admin-only views
--
-- Problem (Supabase advisor: pg_graphql_anon_table_exposed):
--   Multiple tables and views in the public schema are accessible to the
--   `anon` role via GraphQL and PostgREST, but have zero legitimate anon use.
--
--   Categories revoked:
--
--   A) Dated log tables (backfill / reconcile / audit):
--      eco_backfill_log_20260625, eco_date_reconcile_log_20260626,
--      material_reconcile_log_20260626, cnpj_backfill_audit
--
--   B) Queue / job tables (system pipeline, admin-only):
--      asia_image_import_queue, mockup_generation_jobs, optimization_queue_runs
--
--   C) Ingestion / staging / raw history tables:
--      ingestion_run_log, kit_component_enrichment_raw, kit_component_ficha_staging,
--      kit_ficha_session_log, supplier_import_batches,
--      supplier_products_raw_history_p2026_06 through _10,
--      supplier_customization_options_raw
--
--   D) Pipeline / health / QA logs:
--      pipeline_health_log, pipeline_run_log, qa_image_coverage_log,
--      schema_signature_drift_log, spot_health_log, ops_grant_audit
--
--   E) Config tables (admin UI only):
--      category_copywriting_config, eco_material_config, feminine_color_config,
--      packaging_compatibility_config, mockup_prompt_configs
--
--   F) Admin / system tables:
--      markup_configurations, system_changelog, system_documentation,
--      dashboard_insights_cache, conversation_delivery_status,
--      role_migration_batches, role_migration_items
--
--   G) Admin-only monitoring views:
--      v_audit_paradoxos_gravacao, v_blurhash_coverage, v_blurhash_summary,
--      v_color_coverage_monitor, v_connection_health, v_crm_callback_health,
--      v_db_health_check, v_dimensions_source_divergence, v_enrichment_stats,
--      v_gravacao_cobertura, v_image_quality_stats, v_kit_completeness_by_supplier,
--      v_kit_component_completeness, v_kit_component_identity_health,
--      v_kit_enrichment_dashboard, v_kit_ficha_pipeline_health,
--      v_kit_pipeline_health, v_media_statistics
--
-- Objects intentionally kept anon-accessible (public catalog):
--   system_kill_switches   — anon reads for frontend feature flags (kill-switch-client.ts)
--   catalog_analytics      — anon inserts sort events; SELECT not needed (revoked here)
--   mv_product_cards       — public product cards (rest-native.ts external-db layer)
--   mv_product_intelligence — public product badges (useProductIntelligenceBadges.ts)
--   mv_stock_velocity      — public stock display (stockFetcher.ts)
--   v_catalog_stats        — public catalog stats (useCatalogRealStats.ts)
--   v_media_stats          — public product media counts (rest-native.ts)
--
-- Safety:
--   - All 55+ objects confirmed absent from src/ anon-accessible code paths
--   - Config/admin tables used only via authenticated admin components
--   - Monitoring views are internal dashboards (admin-only)
--   - History partition tables never queried by app code
--   - authenticated role retains SELECT on all tables used by admin flows
--   - IF EXISTS guards on each REVOKE make migration idempotent

DO $$
DECLARE
  obj text;

  -- Group A: Dated log / backfill / audit tables
  log_tables text[] := ARRAY[
    'eco_backfill_log_20260625',
    'eco_date_reconcile_log_20260626',
    'material_reconcile_log_20260626',
    'cnpj_backfill_audit'
  ];

  -- Group B: Queue / job tables
  queue_tables text[] := ARRAY[
    'asia_image_import_queue',
    'mockup_generation_jobs',
    'optimization_queue_runs'
  ];

  -- Group C: Ingestion / staging / raw history
  staging_tables text[] := ARRAY[
    'ingestion_run_log',
    'kit_component_enrichment_raw',
    'kit_component_ficha_staging',
    'kit_ficha_session_log',
    'supplier_import_batches',
    'supplier_products_raw_history_p2026_06',
    'supplier_products_raw_history_p2026_07',
    'supplier_products_raw_history_p2026_08',
    'supplier_products_raw_history_p2026_09',
    'supplier_products_raw_history_p2026_10',
    'supplier_customization_options_raw'
  ];

  -- Group D: Pipeline / health / QA logs
  pipeline_tables text[] := ARRAY[
    'pipeline_health_log',
    'pipeline_run_log',
    'qa_image_coverage_log',
    'schema_signature_drift_log',
    'spot_health_log',
    'ops_grant_audit'
  ];

  -- Group E: Config tables (admin UI only)
  config_tables text[] := ARRAY[
    'category_copywriting_config',
    'eco_material_config',
    'feminine_color_config',
    'packaging_compatibility_config',
    'mockup_prompt_configs'
  ];

  -- Group F: Admin / system tables
  admin_tables text[] := ARRAY[
    'markup_configurations',
    'system_changelog',
    'system_documentation',
    'dashboard_insights_cache',
    'conversation_delivery_status',
    'role_migration_batches',
    'role_migration_items'
  ];

  -- Group G: Admin-only monitoring views
  monitoring_views text[] := ARRAY[
    'v_audit_paradoxos_gravacao',
    'v_blurhash_coverage',
    'v_blurhash_summary',
    'v_color_coverage_monitor',
    'v_connection_health',
    'v_crm_callback_health',
    'v_db_health_check',
    'v_dimensions_source_divergence',
    'v_enrichment_stats',
    'v_gravacao_cobertura',
    'v_image_quality_stats',
    'v_kit_completeness_by_supplier',
    'v_kit_component_completeness',
    'v_kit_component_identity_health',
    'v_kit_enrichment_dashboard',
    'v_kit_ficha_pipeline_health',
    'v_kit_pipeline_health',
    'v_media_statistics'
  ];

BEGIN
  -- Process all groups: REVOKE SELECT FROM anon (IF EXISTS guard via pg_class)
  FOREACH obj IN ARRAY (
    log_tables || queue_tables || staging_tables ||
    pipeline_tables || config_tables || admin_tables ||
    monitoring_views
  ) LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = obj
        AND c.relkind IN ('r', 'v', 'm', 'p')  -- table, view, matview, partitioned
    ) THEN
      EXECUTE format('REVOKE SELECT ON public.%I FROM anon', obj);
      RAISE NOTICE 'v REVOKE SELECT ON public.% FROM anon', obj;
    ELSE
      RAISE NOTICE '- public.% not found -- skipping', obj;
    END IF;
  END LOOP;

  RAISE NOTICE 'Done: anon SELECT revoked from internal tables and admin views.';
END;
$$;

-- Also revoke anon SELECT on catalog_analytics (anon only needs INSERT for tracking)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'catalog_analytics'
  ) THEN
    REVOKE SELECT ON public.catalog_analytics FROM anon;
    RAISE NOTICE 'v REVOKE SELECT ON public.catalog_analytics FROM anon (INSERT retained)';
  ELSE
    RAISE NOTICE '- public.catalog_analytics not found -- skipping';
  END IF;
END;
$$;

-- Validate: confirm anon no longer has SELECT on a sample of the revoked objects
DO $$
DECLARE
  obj text;
  still_exposed text[] := ARRAY[]::text[];
  sample text[] := ARRAY[
    'eco_backfill_log_20260625',
    'asia_image_import_queue',
    'pipeline_run_log',
    'markup_configurations',
    'v_db_health_check',
    'v_kit_pipeline_health'
  ];
  has_select boolean;
BEGIN
  FOREACH obj IN ARRAY sample LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = obj
        AND grantee = 'anon'
        AND privilege_type = 'SELECT'
    ) INTO has_select;
    IF has_select THEN
      still_exposed := still_exposed || obj;
    END IF;
  END LOOP;

  IF array_length(still_exposed, 1) > 0 THEN
    RAISE WARNING 'anon SELECT still present on: %', array_to_string(still_exposed, ', ');
  ELSE
    RAISE NOTICE 'v Validation OK: sample objects no longer expose SELECT to anon';
  END IF;
END;
$$;
