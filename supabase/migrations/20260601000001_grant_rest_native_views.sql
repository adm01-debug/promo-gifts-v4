-- Migration: grant_rest_native_views
-- Date: 2026-06-01
-- Context: REST native migration (kill-switch OFF since 2026-05-30).
-- 7 views/MVs are in REST_NATIVE_SAFE_TABLES but return HTTP 401 via PostgREST
-- because the anon/authenticated roles lack SELECT privilege.
-- These were previously served through external-db-bridge (which ran as service_role).
-- Now that all queries go through PostgREST, explicit grants are required.
--
-- Guards: views/MVs podem não existir em preview snapshots (criadas out-of-band
-- em produção). Skip silently quando ausentes.

DO $$
DECLARE
  auth_only text[] := ARRAY[
    'mv_product_compositions', 'mv_product_cards',
    'v_n8n_sync_summary', 'v_n8n_sync_errors', 'v_n8n_sync_success_recent',
    'materials_complete', 'mv_material_group_stats'
  ];
  auth_and_anon text[] := ARRAY[
    'categories_tree_visual', 'mv_product_intelligence'
  ];
  o text;
BEGIN
  FOREACH o IN ARRAY auth_only LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public' AND c.relname = o AND c.relkind IN ('r','v','m','f','p')
    ) THEN
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', o);
    END IF;
  END LOOP;

  FOREACH o IN ARRAY auth_and_anon LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public' AND c.relname = o AND c.relkind IN ('r','v','m','f','p')
    ) THEN
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated, anon', o);
    END IF;
  END LOOP;
END $$;
