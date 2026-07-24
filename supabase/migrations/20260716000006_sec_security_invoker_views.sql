-- SEC P1-3: Convert internal/admin views to security_invoker=on (PG15+)
--
-- Problem: Views without security_invoker=on execute as the VIEW OWNER.
-- Any user who has SELECT on the view can access underlying tables using
-- the owner's privileges, bypassing per-user access control.
--
-- Strategy:
--   Set security_invoker=on on all internal / pipeline / monitoring views.
--   Leave PUBLIC catalog views and views with explicit security_invoker=false
--   unchanged to avoid breaking anon access to product data that relies on
--   the view owner having grants the caller doesn't.
--
-- Excluded from this migration (intentional security_invoker=false or public):
--   v_color_nuances_public, v_kit_component_media_public,
--   v_kit_component_print_areas_public, v_personalization_techniques_public,
--   v_print_area_techniques_public, v_product_compositions_public,
--   v_product_properties_public, v_product_tags_public, v_tags_public,
--   categories_tree_visual (already true), v_catalog_stats (intentional comment),
--   v_products_public, v_suppliers_public, v_variant_sale_prices_public,
--   v_product_images_cdn, v_product_videos_ready, v_super_filtro_options,
--   mv_product_cards, category_icons, vw_novelties_home_highlights,
--   vw_product_novelties_active, vw_sitemap_*, vw_product_availability,
--   vw_packagings_catalog, vw_product_all_packaging_options,
--   vw_product_packaging_options, vw_products_packaging_info, ai_insights_cache
--
-- Already security_invoker=true (no-op, listed for completeness):
--   v_ai_function_routing_effective, v_audit_cobertura_tecnicas,
--   v_db_health_check, v_cf_drift_dashboard, v_category_keywords,
--   v_my_markup_config, v_performance_dashboard, v_price_history_safe,
--   v_product_images_quality_gap, v_product_tokens, v_slow_queries_analysis,
--   vw_image_type_dropblockers, vw_orphan_active_variants,
--   vw_stock_quantity_outliers

-- ─── BI / Quotes ─────────────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.bi_quotes_summary              SET (security_invoker = on);

-- ─── Audit / Paradox ─────────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.v_audit_paradoxos_gravacao     SET (security_invoker = on);

-- ─── Blurhash pipeline ───────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.v_blurhash_coverage            SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_blurhash_summary             SET (security_invoker = on);

-- ─── Cloudflare reconciliation ───────────────────────────────────────────────
ALTER VIEW IF EXISTS public.v_cf_image_remediation         SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_cf_recon_progress            SET (security_invoker = on);

-- ─── Color monitoring ────────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.v_color_coverage_monitor       SET (security_invoker = on);

-- ─── Connection health ───────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.v_connection_health            SET (security_invoker = on);

-- ─── DB health (internal admin) ──────────────────────────────────────────────
ALTER VIEW IF EXISTS public.v_db_health_audit              SET (security_invoker = on);

-- ─── Dimension quality ───────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.v_dimensions_source_divergence SET (security_invoker = on);

-- ─── Gravacao pipeline ───────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.v_gravacao_cobertura           SET (security_invoker = on);

-- ─── Kit pipeline ────────────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.v_kit_completeness_by_supplier SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_kit_component_complete       SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_kit_component_completeness   SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_kit_component_identity_health SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_kit_component_skus           SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_kit_enrichment_dashboard     SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_kit_ficha_pipeline_health    SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_kit_pipeline_health          SET (security_invoker = on);

-- ─── n8n sync monitoring ─────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.v_n8n_sync_errors              SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_n8n_sync_success_recent      SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_n8n_sync_summary             SET (security_invoker = on);

-- ─── Product intelligence / matviews (internal analytics) ───────────────────
ALTER VIEW IF EXISTS public.mv_product_intelligence        SET (security_invoker = on);
ALTER VIEW IF EXISTS public.mv_stock_velocity              SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_product_image_hash_duplicates SET (security_invoker = on);

-- ─── Product quality / AI coverage ──────────────────────────────────────────
ALTER VIEW IF EXISTS public.v_products_ai_coverage         SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_products_dimensions_audit    SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_products_name_audit          SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_products_pending_images      SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_products_public_test         SET (security_invoker = on);

-- ─── Quote / seller KPIs ─────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.v_quote_seller_kpis            SET (security_invoker = on);

-- ─── Stock / velocity ────────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.v_stock_velocity_safe          SET (security_invoker = on);

-- ─── System health / alerts ──────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.v_system_alerts                SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_system_health_dashboard      SET (security_invoker = on);

-- ─── Webhook stats ───────────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.v_webhook_delivery_stats       SET (security_invoker = on);

-- ─── XBZ / parse queue ───────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.v_xbz_ficha_parse_queue        SET (security_invoker = on);

-- ─── Product active badge ────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.v_product_active_badge         SET (security_invoker = on);

-- ─── Medallion / Gold coverage ───────────────────────────────────────────────
ALTER VIEW IF EXISTS public.vw_active_products_missing_gold_images SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_ai_enrichment_status        SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_ai_history_stats            SET (security_invoker = on);

-- ─── Asia pipeline (internal) ────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.vw_asia_products_by_category   SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_asia_products_by_color      SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_asia_products_by_tag        SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_asia_products_low_stock     SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_asia_products_pending       SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_asia_products_promo         SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_asia_products_stats         SET (security_invoker = on);

-- ─── Category / color quality ────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.vw_category_completeness       SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_category_mapping_gaps       SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_color_coverage              SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_color_mapping               SET (security_invoker = on);

-- ─── Image health ────────────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.vw_image_type_coherence        SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_images_pending_dimensions   SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_product_images_health       SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_product_images_variant_gap  SET (security_invoker = on);

-- ─── Medallion coverage ──────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.vw_medallion_coverage          SET (security_invoker = on);

-- ─── Novelty health (internal monitoring) ────────────────────────────────────
ALTER VIEW IF EXISTS public.vw_novelty_health              SET (security_invoker = on);

-- ─── Packaging (internal) ────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.vw_packaging_health            SET (security_invoker = on);

-- ─── Product pipeline / QA ───────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.vw_product_notebook_complete   SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_products_pending_variants   SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_products_seo_status         SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_produtos_sem_ncm            SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_qa_products_missing_images  SET (security_invoker = on);

-- ─── Rupture / stock QA ──────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.vw_rupture_confidence_audit    SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_rupture_gap_purchase        SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_rupture_live_divergence     SET (security_invoker = on);

-- ─── SEO ─────────────────────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.vw_seo_dashboard               SET (security_invoker = on);

-- ─── Source / channel ────────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.vw_source_channel_coverage     SET (security_invoker = on);

-- ─── SPOT internal health ────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.vw_spot_cf_health              SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_spot_color_health           SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_spot_color_separator_reference SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_spot_image_coverage         SET (security_invoker = on);
ALTER VIEW IF EXISTS public.vw_spot_price_alerts           SET (security_invoker = on);

-- ─── Validate: count views still without security_invoker ────────────────────
DO $$
DECLARE
  v_count integer;
  v_public_exempt text[] := ARRAY[
    -- Intentional security_invoker=false
    'v_color_nuances_public', 'v_kit_component_media_public',
    'v_kit_component_print_areas_public', 'v_personalization_techniques_public',
    'v_print_area_techniques_public', 'v_product_compositions_public',
    'v_product_properties_public', 'v_product_tags_public', 'v_tags_public',
    -- Public catalog (anon access, intentional owner-privilege pattern)
    'v_catalog_stats', 'v_products_public', 'v_suppliers_public',
    'v_variant_sale_prices_public', 'v_product_images_cdn', 'v_product_videos_ready',
    'v_super_filtro_options', 'mv_product_cards', 'category_icons',
    'vw_novelties_home_highlights', 'vw_product_novelties_active',
    'vw_sitemap_all', 'vw_sitemap_categories', 'vw_sitemap_products',
    'vw_product_availability', 'vw_packagings_catalog', 'vw_product_all_packaging_options',
    'vw_product_packaging_options', 'vw_products_packaging_info',
    'ai_insights_cache', 'v_product_active_badge'
  ];
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'v'
    AND NOT (c.relname = ANY(v_public_exempt))
    AND NOT ('security_invoker=on' = ANY(coalesce(c.reloptions, ARRAY[]::text[])))
    AND NOT ('security_invoker=true' = ANY(coalesce(c.reloptions, ARRAY[]::text[])));

  RAISE NOTICE 'Views remaining without security_invoker (excl. exempt): %', v_count;
  -- Not raising EXCEPTION — new views may be added after this migration.
  -- Run: SELECT relname FROM pg_class ... to audit future additions.
END;
$$;
