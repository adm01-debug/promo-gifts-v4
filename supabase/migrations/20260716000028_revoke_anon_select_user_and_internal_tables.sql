-- Migration 028: Revoke anon SELECT from user-specific, admin, and internal tables/views
--
-- Source: 200-commit audit + agent analysis of 100% src/ usage patterns
-- All listed objects confirmed to have no legitimate anon SELECT need:
--   - User-specific data tables: require authenticated session + RLS
--   - Admin/CRM tables: authenticated admin panels only
--   - Collections/collaboration: authenticated users only (if (!user?.id) return guards)
--   - Analytics/tracking: either zero refs in src/ or INSERT-only under auth check
--   - Internal pipeline tables: service_role only (no frontend reads)
--   - Webhook/edge tables: edge functions run as service_role, not anon
--   - Admin-only views: internal dashboards, health monitors, QA views
--
-- Objects intentionally kept anon-accessible:
--   system_kill_switches  — anon reads for kill-switch-client.ts feature flags
--   system_settings       — AppBootstrap.tsx pre-auth maintenance mode check
--   catalog tables/views  — product_variants, categories, product_images, mv_product_cards,
--                           mv_product_intelligence, mv_stock_velocity, v_products_public,
--                           v_super_filtro_options, v_catalog_stats, v_media_stats, etc.
--   vw_sitemap_*          — public sitemap generation (rest-native.ts)
--   v_*_public views      — public-facing API surface for catalog features
--
-- Safety: IF EXISTS guards on every object via pg_class / pg_views checks.
--         REVOKE on a non-existent privilege is a no-op; REVOKE on a non-existent
--         object would error, hence the existence check pattern.

DO $$
DECLARE
  obj text;

  -- A) User-specific data (auth-gated, RLS-scoped)
  user_tables text[] := ARRAY[
    'orders',
    'order_items',
    'order_item_personalizations',
    'seller_carts',
    'seller_cart_items',
    'profiles',
    'user_roles',
    'role_permissions',
    'permissions',
    'user_preferences',
    'user_onboarding',
    'user_notification_preferences',
    'user_comparisons',
    'user_favorites',
    'user_filter_presets',
    'user_search_history',
    'user_organizations',
    'user_ip_allowlist',
    'saved_filters',
    'saved_trends_views',
    'notifications',
    'workspace_notifications',
    'push_subscriptions',
    'notification_preferences',
    'notification_templates',
    'scheduled_reports',
    'simulator_wizard_drafts',
    'recently_viewed_products',
    'navigation_analytics',
    'price_history'
  ];

  -- B) Admin / CRM / Business intelligence (authenticated admin panels only)
  admin_tables text[] := ARRAY[
    'crm_callback_events',
    'discount_approval_requests',
    'enriched_contacts',
    'follow_up_reminders',
    'external_connections',
    'connection_test_history',
    'ip_access_control',
    'geo_allowed_countries',
    'hardening_health_snapshots',
    'public_token_failures',
    'company_email_patterns',
    'organizations',
    'organization_members',
    'product_price_freshness_overrides',
    'product_ai_content',
    'product_ai_history',
    'product_qa_image_alerts',
    'pipeline_control',
    'pipeline_known_issues',
    'import_pipeline_steps',
    'medallion_coverage_snapshots',
    'schema_drift_allowlist',
    'schema_signature_baseline',
    'schema_signature_drift_allowlist',
    'hardening_health_snapshots',
    'magazine_view_rollup_watermark',
    'stock_daily_summary',
    'stock_snapshots',
    'mockup_prompt_history',
    'mockup_approval_links',
    'mockup_credit_transactions',
    'mockup_credits',
    'classify_functions_registry',
    'sm_worker_partitions',
    'spot_typecode_map',
    'seo_redirects',
    'ai_models'
  ];

  -- C) Collections / Collaboration / Favorites (authenticated, if (!user?.id) return guards)
  collab_tables text[] := ARRAY[
    'collections',
    'collection_items',
    'collection_items_trash',
    'collection_products',
    'collection_item_reactions',
    'expert_conversations',
    'expert_messages',
    'favorite_items',
    'favorite_items_trash',
    'favorite_lists',
    'favorite_item_reactions',
    'kit_collaborators',
    'kit_comments',
    'kit_share_tokens',
    'kit_templates',
    'custom_kits',
    'cart_templates',
    'comparison_reactions',
    'magic_up_brand_kits',
    'magic_up_campaigns',
    'magic_up_comments',
    'magic_up_generations',
    'magic_up_public_shares',
    'magic_up_reactions',
    'mockup_drafts',
    'generated_mockups',
    'art_file_attachments',
    'component_media'
  ];

  -- D) Analytics / Tracking (zero refs in src/ or INSERT-only under auth check)
  analytics_tables text[] := ARRAY[
    'analytics_events',
    'search_queries',
    'search_analytics',
    'edge_function_invocations',
    'visual_search_feedback',
    'conversation_event_history',
    'content_articles'
  ];

  -- E) Internal pipeline / Infrastructure (service_role only)
  pipeline_tables text[] := ARRAY[
    'webhook_delivery_locks',
    'webhook_dispatcher_log',
    'webhook_outbox',
    'video_import_queue',
    'video_sim_results',
    'asia_upload_mapping',
    'xbz_gallery_staging',
    'xbz_upload_mapping',
    'auto_tag_rules',
    'b2b_collection_products',
    'b2b_collections',
    'supplier_products_raw',
    'notification_templates',
    'push_subscriptions'
  ];

BEGIN
  FOREACH obj IN ARRAY (
    user_tables || admin_tables || collab_tables || analytics_tables || pipeline_tables
  ) LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = obj
        AND c.relkind IN ('r', 'p')
    ) THEN
      EXECUTE format('REVOKE SELECT ON public.%I FROM anon', obj);
      RAISE NOTICE '✓ REVOKE SELECT ON public.% FROM anon', obj;
    ELSE
      RAISE NOTICE '- public.% not found -- skipping', obj;
    END IF;
  END LOOP;

  RAISE NOTICE 'Done: tables processed.';
END;
$$;

-- Special case: kill_switch_hits
-- kill-switch-telemetry.ts does INSERT with user_role:'anon', but SELECT is admin-only.
-- Revoke SELECT; preserve INSERT (and re-assert it explicitly).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'kill_switch_hits'
  ) THEN
    REVOKE SELECT ON public.kill_switch_hits FROM anon;
    GRANT INSERT ON public.kill_switch_hits TO anon;  -- preserve telemetry inserts
    RAISE NOTICE '✓ kill_switch_hits: revoked SELECT, re-asserted INSERT for anon';
  END IF;
END;
$$;

-- ─── Admin-only v_* views ────────────────────────────────────────────────────
DO $$
DECLARE
  obj text;
  admin_views text[] := ARRAY[
    -- Pipeline / QA admin views (confirmed admin-only)
    'v_pipeline_progress',
    'v_pipeline_next_step',
    'v_products_missing_primary_image',
    'v_products_without_images',
    'v_products_without_video',
    'v_products_ai_coverage',
    'v_products_dimensions_audit',
    'v_products_images_summary',
    'v_products_name_audit',
    'v_products_pending_images',
    'v_product_image_hash_duplicates',
    'v_product_tokens',
    'v_unmapped_images',
    'v_products_public_test',
    -- Video admin views
    'v_video_dashboard',
    'v_video_validation_recent',
    'v_videos_pending',
    -- Webhook/internal
    'v_webhook_delivery_stats',
    'v_xbz_ficha_parse_queue'
  ];
BEGIN
  FOREACH obj IN ARRAY admin_views LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = obj
        AND c.relkind IN ('v', 'm')
    ) THEN
      EXECUTE format('REVOKE SELECT ON public.%I FROM anon', obj);
      RAISE NOTICE '✓ REVOKE SELECT ON public.% FROM anon', obj;
    ELSE
      RAISE NOTICE '- public.% not found -- skipping', obj;
    END IF;
  END LOOP;
END;
$$;

-- ─── Admin/internal vw_* views ───────────────────────────────────────────────
DO $$
DECLARE
  obj text;
  internal_views text[] := ARRAY[
    -- ASIA supplier pipeline (internal import)
    'vw_asia_products_by_category',
    'vw_asia_products_by_color',
    'vw_asia_products_by_tag',
    'vw_asia_products_errors',
    'vw_asia_products_low_stock',
    'vw_asia_products_pending',
    'vw_asia_products_promo',
    'vw_asia_products_stats',
    -- XBZ supplier pipeline (internal import)
    'vw_xbz_products_by_category',
    'vw_xbz_products_by_color',
    'vw_xbz_products_stats',
    'vw_xbz_scraping_status',
    -- Spot supplier health monitoring
    'vw_spot_cf_health',
    'vw_spot_color_health',
    'vw_spot_color_separator_reference',
    'vw_spot_image_coverage',
    'vw_spot_price_alerts',
    -- Somarcas sync (internal)
    'vw_somarcas_pending',
    'vw_somarcas_stats',
    'vw_somarcas_sync_status',
    -- Supplier admin views
    'vw_supplier_category_coverage',
    'vw_supplier_color_mappings',
    'vw_supplier_field_mappings_summary',
    'vw_supplier_mapping_statistics',
    'vw_supplier_products_raw_status',
    -- Admin health / system
    'vw_system_health_quick',
    'vw_super_filtro_health',
    'vw_medallion_coverage',
    -- AI admin
    'vw_ai_enrichment_status',
    'vw_ai_history_stats',
    'vw_products_ai_status',
    -- Image / media QA
    'vw_active_products_missing_gold_images',
    'vw_qa_products_missing_images',
    'vw_duplicate_images',
    'vw_image_type_coherence',
    'vw_images_pending_dimensions',
    'vw_product_images_health',
    'vw_product_images_variant_gap',
    -- Color admin
    'vw_color_coverage',
    'vw_color_mapping',
    -- Category admin analysis
    'vw_category_accessories',
    'vw_category_commemorative_dates',
    'vw_category_mapping_gaps',
    'vw_category_target_audiences',
    'vw_category_variation_types',
    -- SEO / sitemaps (admin view; vw_sitemap_products/categories kept)
    'vw_seo_dashboard',
    'vw_produtos_sem_ncm',
    -- Rupture / stock admin
    'vw_rupture_confidence_audit',
    'vw_rupture_gap_purchase',
    'vw_rupture_live_divergence',
    -- Product admin dashboards
    'vw_products_pending_variants',
    'vw_products_seo_status',
    'vw_products_by_date',
    'vw_products_by_property_category',
    'vw_products_thermal_status',
    'vw_property_statistics',
    'vw_source_channel_coverage',
    'vw_component_types_usage',
    -- Misc admin
    'vw_media_stats_by_type',
    'vw_novelty_health'
  ];
BEGIN
  FOREACH obj IN ARRAY internal_views LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = obj
        AND c.relkind IN ('v', 'm')
    ) THEN
      EXECUTE format('REVOKE SELECT ON public.%I FROM anon', obj);
      RAISE NOTICE '✓ REVOKE SELECT ON public.% FROM anon', obj;
    ELSE
      RAISE NOTICE '- public.% not found -- skipping', obj;
    END IF;
  END LOOP;

  RAISE NOTICE 'Done: admin/internal views processed.';
END;
$$;

-- ─── Validation sample ───────────────────────────────────────────────────────
DO $$
DECLARE
  obj text;
  still_exposed text[] := ARRAY[]::text[];
  sample text[] := ARRAY[
    'orders',
    'profiles',
    'seller_carts',
    'user_roles',
    'crm_callback_events',
    'webhook_delivery_locks',
    'visual_search_feedback',
    'v_pipeline_progress',
    'vw_medallion_coverage',
    'vw_asia_products_stats'
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
    RAISE NOTICE '✓ Validation OK: sample objects no longer expose SELECT to anon';
  END IF;
END;
$$;
