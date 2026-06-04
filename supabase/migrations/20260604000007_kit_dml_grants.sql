-- Migration: GRANT INSERT/UPDATE/DELETE on kit tables to authenticated role.
-- RLS policies alone are necessary but not sufficient for PostgREST DML —
-- the authenticated role also needs table-level privileges. Without these
-- grants, write operations fail at the privilege layer before RLS is checked.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'kit_component_print_areas'
  ) THEN
    GRANT INSERT, UPDATE, DELETE ON public.kit_component_print_areas TO authenticated;
    RAISE NOTICE 'Granted DML on kit_component_print_areas to authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'kit_component_media'
  ) THEN
    GRANT INSERT, UPDATE, DELETE ON public.kit_component_media TO authenticated;
    RAISE NOTICE 'Granted DML on kit_component_media to authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'product_kit_components'
  ) THEN
    GRANT INSERT, UPDATE, DELETE ON public.product_kit_components TO authenticated;
    RAISE NOTICE 'Granted DML on product_kit_components to authenticated';
  END IF;
END $$;
