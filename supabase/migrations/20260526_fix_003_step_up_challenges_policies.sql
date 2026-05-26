-- =============================================================================
-- FIX-003: step_up_challenges — Add missing INSERT / UPDATE / DELETE policies
-- Bug: Authenticated users cannot create or consume their own MFA challenges
-- Applied: 2026-05-26
-- =============================================================================

CREATE POLICY step_up_challenges_insert_own
  ON public.step_up_challenges
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
  );

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

CREATE POLICY step_up_challenges_delete_own_or_admin
  ON public.step_up_challenges
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR is_admin_or_above((SELECT auth.uid()))
  );
