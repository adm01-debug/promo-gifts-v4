-- SEC: Drop two INSERT policies with WITH CHECK = true (rls_policy_always_true WARN)
--
-- Supabase linter lint=0009_rls_policy_always_true flagged:
--   kit_component_enrichment_raw  → kcer_pipeline_insert  (WITH CHECK = true)
--   kit_component_padronizacao    → kcpad_pipeline_insert  (WITH CHECK = true)
--
-- Both policies apply to the {public} (= every role) pseudo-role, allowing any
-- authenticated or anonymous caller to INSERT into these tables unchecked.
--
-- Fix: DROP the open INSERT policies. Pipeline processes use service_role which
-- bypasses RLS entirely, so drops are non-breaking. Admin inserts remain covered
-- by the existing ALL policies (kcer_admin_all / kcpad_admin_write).

DROP POLICY IF EXISTS kcer_pipeline_insert  ON public.kit_component_enrichment_raw;
DROP POLICY IF EXISTS kcpad_pipeline_insert ON public.kit_component_padronizacao;

-- ─── Validate ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename IN ('kit_component_enrichment_raw', 'kit_component_padronizacao')
      AND policyname IN ('kcer_pipeline_insert', 'kcpad_pipeline_insert')
  ) THEN
    RAISE EXCEPTION 'rls_policy_always_true fix FAILED — open INSERT policies still exist';
  END IF;

  RAISE NOTICE 'Dropped kcer_pipeline_insert and kcpad_pipeline_insert — WITH CHECK=true policies removed';
END;
$$;
