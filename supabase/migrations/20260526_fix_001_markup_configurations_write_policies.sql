-- =============================================================================
-- FIX-001: markup_configurations — Add missing write policies
-- Bug: Admin/owner cannot create, update, or delete markup configurations
-- Applied: 2026-05-26
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'markup_configurations' AND policyname = 'markup_configurations_insert'
  ) THEN
    CREATE POLICY markup_configurations_insert
  ON public.markup_configurations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_org_owner_or_admin(organization_id)
  );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'markup_configurations' AND policyname = 'markup_configurations_update'
  ) THEN
    CREATE POLICY markup_configurations_update
  ON public.markup_configurations
  FOR UPDATE
  TO authenticated
  USING (is_org_owner_or_admin(organization_id))
  WITH CHECK (is_org_owner_or_admin(organization_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'markup_configurations' AND policyname = 'markup_configurations_delete'
  ) THEN
    CREATE POLICY markup_configurations_delete
  ON public.markup_configurations
  FOR DELETE
  TO authenticated
  USING (is_org_owner_or_admin(organization_id));
  END IF;
END $$;
