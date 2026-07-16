-- Migration: Enable security_invoker=on on all public views missing it
--
-- Problem (Supabase advisor: security_definer_view):
--   PostgreSQL views run as SECURITY DEFINER (owner) by default.
--   This means RLS policies on underlying tables are bypassed when
--   anon/authenticated roles query through these views — opening a
--   privilege-escalation vector (Supabase lints 0028/0029 equivalent).
--
-- Fix:
--   ALTER VIEW ... SET (security_invoker = on) forces the view to
--   execute with the CALLING role's permissions, so RLS applies
--   correctly for each caller without needing to DROP/CREATE views.
--
-- Safety:
--   - Views with no RLS on underlying tables: no behavior change
--   - Views with RLS: now correctly enforce caller's policies
--   - Admin/internal views (v_system_alerts, v_cf_image_remediation, etc.)
--     already have restricted ACL (no anon/authenticated grants)
--   - PostgreSQL 17 (Supabase PG17): ALTER VIEW SET is idempotent

ALTER VIEW public.ai_insights_cache SET (security_invoker = on);
ALTER VIEW public.categories_tree_visual SET (security_invoker = on);
ALTER VIEW public.mv_material_group_stats SET (security_invoker = on);
ALTER VIEW public.mv_media_health SET (security_invoker = on);
ALTER VIEW public.mv_product_cards SET (security_invoker = on);
ALTER VIEW public.mv_product_compositions SET (security_invoker = on);
ALTER VIEW public.v_ai_function_routing_effective SET (security_invoker = on);
ALTER VIEW public.v_audit_cobertura_tecnicas SET (security_invoker = on);
ALTER VIEW public.v_catalog_stats SET (security_invoker = on);
ALTER VIEW public.v_category_keywords SET (security_invoker = on);
ALTER VIEW public.v_cf_drift_dashboard SET (security_invoker = on);
ALTER VIEW public.v_color_nuances_public SET (security_invoker = on);
ALTER VIEW public.v_db_health_check SET (security_invoker = on);
ALTER VIEW public.v_kit_component_media_public SET (security_invoker = on);
ALTER VIEW public.v_kit_component_print_areas_public SET (security_invoker = on);
ALTER VIEW public.v_my_markup_config SET (security_invoker = on);
ALTER VIEW public.v_performance_dashboard SET (security_invoker = on);
ALTER VIEW public.v_personalization_techniques_public SET (security_invoker = on);
ALTER VIEW public.v_price_history_safe SET (security_invoker = on);
ALTER VIEW public.v_print_area_techniques_public SET (security_invoker = on);
ALTER VIEW public.v_product_compositions_public SET (security_invoker = on);
ALTER VIEW public.v_product_images_cdn SET (security_invoker = on);
ALTER VIEW public.v_product_images_quality_gap SET (security_invoker = on);
ALTER VIEW public.v_product_properties_public SET (security_invoker = on);
ALTER VIEW public.v_product_tags_public SET (security_invoker = on);
ALTER VIEW public.v_product_tokens SET (security_invoker = on);
ALTER VIEW public.v_product_videos_ready SET (security_invoker = on);
ALTER VIEW public.v_products_public SET (security_invoker = on);
ALTER VIEW public.v_slow_queries_analysis SET (security_invoker = on);
ALTER VIEW public.v_super_filtro_options SET (security_invoker = on);
ALTER VIEW public.v_suppliers_public SET (security_invoker = on);
ALTER VIEW public.v_tags_public SET (security_invoker = on);
ALTER VIEW public.v_variant_sale_prices_public SET (security_invoker = on);
ALTER VIEW public.vw_image_type_dropblockers SET (security_invoker = on);
ALTER VIEW public.vw_novelties_home_highlights SET (security_invoker = on);
ALTER VIEW public.vw_orphan_active_variants SET (security_invoker = on);
ALTER VIEW public.vw_packagings_catalog SET (security_invoker = on);
ALTER VIEW public.vw_product_all_packaging_options SET (security_invoker = on);
ALTER VIEW public.vw_product_availability SET (security_invoker = on);
ALTER VIEW public.vw_product_novelties_active SET (security_invoker = on);
ALTER VIEW public.vw_product_packaging_options SET (security_invoker = on);
ALTER VIEW public.vw_products_packaging_info SET (security_invoker = on);
ALTER VIEW public.vw_sitemap_all SET (security_invoker = on);
ALTER VIEW public.vw_sitemap_categories SET (security_invoker = on);
ALTER VIEW public.vw_sitemap_products SET (security_invoker = on);
ALTER VIEW public.vw_stock_quantity_outliers SET (security_invoker = on);
ALTER VIEW public.vw_super_filtro_health SET (security_invoker = on);
ALTER VIEW public.vw_supplier_category_coverage SET (security_invoker = on);
ALTER VIEW public.vw_supplier_field_mappings_summary SET (security_invoker = on);
ALTER VIEW public.vw_system_health_quick SET (security_invoker = on);
ALTER VIEW public.vw_xbz_produtos_sem_imagem SET (security_invoker = on);
ALTER VIEW public.vw_xbz_scraping_status SET (security_invoker = on);
