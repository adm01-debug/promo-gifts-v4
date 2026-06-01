-- ============================================================================
-- GRANT SELECT on 7 analytics wrapper views to authenticated
-- ============================================================================
-- Root cause: views created with security_invoker=true but no GRANT for
-- authenticated on EITHER layer (public wrapper OR analytics source).
-- PostgREST returns 403 "permission denied for view mv_product_intelligence".
--
-- Applied in production via Supabase MCP on 2026-05-31. This file = git tracking.
-- Guards: cada view/MV pode não existir em preview snapshots (criadas out-of-band).
-- ============================================================================

DO $$
DECLARE
  obj record;
  -- public wrapper objects (table_schema='public') + analytics objects
  objs text[] := ARRAY[
    'public.mv_product_intelligence',
    'public.mv_stock_velocity',
    'public.mv_product_cards',
    'public.mv_product_compositions',
    'public.mv_material_group_stats',
    'public.mv_media_health',
    'public.categories_tree_visual',
    'analytics.mv_product_intelligence',
    'analytics.mv_stock_velocity',
    'analytics.mv_product_cards',
    'analytics.mv_product_compositions',
    'analytics.mv_material_group_stats',
    'analytics.mv_media_health',
    'analytics.categories_tree_visual'
  ];
  o text;
  schema_n text;
  obj_n text;
BEGIN
  FOREACH o IN ARRAY objs LOOP
    schema_n := split_part(o, '.', 1);
    obj_n := split_part(o, '.', 2);
    -- Check if the object exists as view, matview, or table
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = schema_n AND c.relname = obj_n AND c.relkind IN ('r','v','m','f','p')
    ) THEN
      EXECUTE format('GRANT SELECT ON %s TO authenticated', o);
    END IF;
  END LOOP;

  -- Defense in depth: REVOKE INSERT/UPDATE/DELETE only on public wrappers that exist
  FOR obj IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname IN ('mv_product_intelligence','mv_stock_velocity','mv_product_cards','mv_product_compositions','mv_material_group_stats','mv_media_health','categories_tree_visual')
      AND c.relkind IN ('v','m')
  LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated, anon, public', obj.relname);
  END LOOP;
END $$;
