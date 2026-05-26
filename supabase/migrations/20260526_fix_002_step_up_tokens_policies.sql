-- =============================================================================
-- FIX-002: step_up_tokens — Add missing INSERT / UPDATE / DELETE policies
-- Bug: Authenticated users cannot create or consume their own step-up tokens
-- Note: service_role always bypasses RLS — edge functions remain unaffected
-- Applied: 2026-05-26
-- =============================================================================

CREATE POLICY step_up_tokens_insert_own
  ON public.step_up_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
  );

CREATE POLICY step_up_tokens_update_own
  ON public.step_up_tokens
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

CREATE POLICY step_up_tokens_delete_admin
  ON public.step_up_tokens
  FOR DELETE
  TO authenticated
  USING (
    is_admin_or_above((SELECT auth.uid()))
    OR (
      (SELECT auth.uid()) = user_id
      AND expires_at < now()
    )
  );
