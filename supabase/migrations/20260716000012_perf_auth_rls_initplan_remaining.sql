-- PERF: Fix remaining auth_rls_initplan — 10 policies across 8 tables
-- lint=0003_auth_rls_initplan WARN
--
-- Migration 000002 fixed high-traffic tables. This covers the 8 remaining
-- tables still calling auth.uid() / auth.role() / current_setting() without
-- the (SELECT ...) wrapper that prevents per-row re-evaluation.
--
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan

-- ─── kit_component_enrichment_raw ─────────────────────────────────────────────

DROP POLICY IF EXISTS kcer_admin_all ON public.kit_component_enrichment_raw;
CREATE POLICY kcer_admin_all ON public.kit_component_enrichment_raw
  FOR ALL TO public
  USING (is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));

DROP POLICY IF EXISTS kcer_read_auth ON public.kit_component_enrichment_raw;
CREATE POLICY kcer_read_auth ON public.kit_component_enrichment_raw
  FOR SELECT TO public
  USING ((SELECT auth.uid()) IS NOT NULL);

-- ─── kit_component_padronizacao ───────────────────────────────────────────────

DROP POLICY IF EXISTS kcpad_admin_write ON public.kit_component_padronizacao;
CREATE POLICY kcpad_admin_write ON public.kit_component_padronizacao
  FOR ALL TO public
  USING (is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));

DROP POLICY IF EXISTS kcpad_read_auth ON public.kit_component_padronizacao;
CREATE POLICY kcpad_read_auth ON public.kit_component_padronizacao
  FOR SELECT TO public
  USING ((SELECT auth.uid()) IS NOT NULL);

-- ─── magazine_public_reactions ────────────────────────────────────────────────

DROP POLICY IF EXISTS reactions_read_owner ON public.magazine_public_reactions;
CREATE POLICY reactions_read_owner ON public.magazine_public_reactions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.magazines m
    WHERE m.id = magazine_public_reactions.magazine_id
      AND m.owner_id = (SELECT auth.uid())
  ));

-- ─── magazine_reader_state ────────────────────────────────────────────────────

DROP POLICY IF EXISTS reader_state_owner_read ON public.magazine_reader_state;
CREATE POLICY reader_state_owner_read ON public.magazine_reader_state
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ─── pipeline_health_log ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS pipeline_health_log_service_only ON public.pipeline_health_log;
CREATE POLICY pipeline_health_log_service_only ON public.pipeline_health_log
  FOR ALL TO public
  USING ((SELECT auth.role()) = 'service_role');

-- ─── smoke_test_runs ──────────────────────────────────────────────────────────
-- current_setting() also re-evaluates per-row without (SELECT ...)

DROP POLICY IF EXISTS smoke_insert_service_role ON public.smoke_test_runs;
CREATE POLICY smoke_insert_service_role ON public.smoke_test_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT COALESCE(current_setting('request.jwt.claim.role', true), '')) = 'service_role'
    OR is_admin_or_above((SELECT auth.uid()))
  );

-- ─── webhook_dispatcher_log ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins podem ler dispatcher_log" ON public.webhook_dispatcher_log;
CREATE POLICY "Admins podem ler dispatcher_log" ON public.webhook_dispatcher_log
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'admin'
  ));

-- ─── workspace_notifications ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated can insert notifications for valid users" ON public.workspace_notifications;
CREATE POLICY "Authenticated can insert notifications for valid users" ON public.workspace_notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND user_id IS NOT NULL
  );

-- ─── Validate ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      (tablename = 'kit_component_enrichment_raw' AND policyname IN ('kcer_admin_all', 'kcer_read_auth'))
      OR (tablename = 'kit_component_padronizacao'  AND policyname IN ('kcpad_admin_write', 'kcpad_read_auth'))
      OR (tablename = 'magazine_public_reactions'   AND policyname = 'reactions_read_owner')
      OR (tablename = 'magazine_reader_state'       AND policyname = 'reader_state_owner_read')
      OR (tablename = 'pipeline_health_log'         AND policyname = 'pipeline_health_log_service_only')
      OR (tablename = 'smoke_test_runs'             AND policyname = 'smoke_insert_service_role')
      OR (tablename = 'webhook_dispatcher_log'      AND policyname = 'Admins podem ler dispatcher_log')
      OR (tablename = 'workspace_notifications'     AND policyname = 'Authenticated can insert notifications for valid users')
    );

  IF v_count <> 10 THEN
    RAISE EXCEPTION 'auth_rls_initplan fix FAILED — expected 10 policies, found %', v_count;
  END IF;

  RAISE NOTICE 'auth_rls_initplan fixed — 10 policies across 8 tables now use (SELECT auth.*()) pattern';
END;
$$;
