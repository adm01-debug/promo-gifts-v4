-- ============================================================================
-- GRANT SELECT on 7 analytics wrapper views to authenticated
-- ============================================================================
-- Root cause: views created with security_invoker=true but no GRANT for
-- authenticated on EITHER layer (public wrapper OR analytics source).
-- PostgREST returns 403 "permission denied for view mv_product_intelligence".
--
-- Applied in production via Supabase MCP on 2026-05-31. This file = git tracking.
-- ============================================================================

-- Layer 1: public wrapper views
GRANT SELECT ON public.mv_product_intelligence TO authenticated;
GRANT SELECT ON public.mv_stock_velocity TO authenticated;
GRANT SELECT ON public.mv_product_cards TO authenticated;
GRANT SELECT ON public.mv_product_compositions TO authenticated;
GRANT SELECT ON public.mv_material_group_stats TO authenticated;
GRANT SELECT ON public.mv_media_health TO authenticated;
GRANT SELECT ON public.categories_tree_visual TO authenticated;

-- Layer 2: analytics source tables (security_invoker=true requires this)
GRANT SELECT ON analytics.mv_product_intelligence TO authenticated;
GRANT SELECT ON analytics.mv_stock_velocity TO authenticated;
GRANT SELECT ON analytics.mv_product_cards TO authenticated;
GRANT SELECT ON analytics.mv_product_compositions TO authenticated;
GRANT SELECT ON analytics.mv_material_group_stats TO authenticated;
GRANT SELECT ON analytics.mv_media_health TO authenticated;
GRANT SELECT ON analytics.categories_tree_visual TO authenticated;

-- Defense in depth: no writes on wrapper views
REVOKE INSERT, UPDATE, DELETE ON public.mv_product_intelligence FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.mv_stock_velocity FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.mv_product_cards FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.mv_product_compositions FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.mv_material_group_stats FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.mv_media_health FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.categories_tree_visual FROM authenticated, anon, public;
