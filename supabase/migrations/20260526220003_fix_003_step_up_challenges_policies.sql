-- =============================================================================
-- FIX-003: step_up_challenges — Add missing INSERT / UPDATE / DELETE policies
-- Bug: Authenticated users cannot create or consume their own MFA challenges
-- Applied: 2026-05-26
-- Guard: tabela step_up_challenges pode não existir em preview snapshots.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'step_up_challenges'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'step_up_challenges' AND policyname = 'step_up_challenges_insert_own'
  ) THEN
    CREATE POLICY step_up_challenges_insert_own
  ON public.step_up_challenges
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
  );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'step_up_challenges'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'step_up_challenges' AND policyname = 'step_up_challenges_update_own'
  ) THEN
    CREATE POLICY step_up_challenges_update_own
  ON public.step_up_challenges
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND consumed = false
    AND expires_at > now()
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
  );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'step_up_challenges'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'step_up_challenges' AND policyname = 'step_up_challenges_delete_own_or_admin'
  ) THEN
    CREATE POLICY step_up_challenges_delete_own_or_admin
  ON public.step_up_challenges
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR is_admin_or_above((SELECT auth.uid()))
  );
  END IF;
END $$;
