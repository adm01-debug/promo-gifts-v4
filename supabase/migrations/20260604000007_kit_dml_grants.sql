-- Migration: GRANT INSERT/UPDATE/DELETE on kit tables to authenticated role.
-- RLS policies alone are necessary but not sufficient for PostgREST DML —
-- the authenticated role also needs table-level privileges. Without these
-- grants, write operations fail at the privilege layer before RLS is checked.
--
-- ENABLE ROW LEVEL SECURITY is added defensively: these tables were created
-- outside migrations (via Lovable/Supabase UI) and may or may not have RLS
-- enabled. Without RLS active, the admin-only write policies are ignored and
-- any authenticated user can mutate rows. ALTER TABLE ... ENABLE ROW LEVEL
-- SECURITY is idempotent — safe to run even if already enabled.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'kit_component_print_areas'
  ) THEN
    ALTER TABLE public.kit_component_print_areas ENABLE ROW LEVEL SECURITY;
    GRANT INSERT, UPDATE, DELETE ON public.kit_component_print_areas TO authenticated;
    RAISE NOTICE 'Enabled RLS and granted DML on kit_component_print_areas to authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'kit_component_media'
  ) THEN
    ALTER TABLE public.kit_component_media ENABLE ROW LEVEL SECURITY;
    GRANT INSERT, UPDATE, DELETE ON public.kit_component_media TO authenticated;
    RAISE NOTICE 'Enabled RLS and granted DML on kit_component_media to authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'product_kit_components'
  ) THEN
    -- product_kit_components already has ENABLE ROW LEVEL SECURITY from
    -- migration 20250103070000_complete_catalog_structure.sql; re-enabling is a no-op.
    ALTER TABLE public.product_kit_components ENABLE ROW LEVEL SECURITY;
    GRANT INSERT, UPDATE, DELETE ON public.product_kit_components TO authenticated;
    RAISE NOTICE 'Enabled RLS and granted DML on product_kit_components to authenticated';
  END IF;
END $$;
