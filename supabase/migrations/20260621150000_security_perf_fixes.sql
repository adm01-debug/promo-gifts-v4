-- Security + Performance hardening — 2026-06-21
-- Findings from Supabase Advisors (security + performance) run post-faxina audit.
--
-- CHANGES (in priority order):
--
-- [P0] SECURITY: restrict get_edge_anon_key to service_role only
--   Function was EXECUTE-grantable to any `authenticated` user despite being
--   SECURITY DEFINER and returning the project anon JWT. Revoke from `authenticated`.
--
-- [P1] SECURITY/PERF: fix auth_rls_initplan on 5 public policies
--   RLS policies that call auth.uid() directly force PostgreSQL to re-evaluate the
--   auth function on every row (initplan vs cached). Fix: wrap in (SELECT auth.uid()).
--   Affected: kit_component_enrichment_raw (×2), kit_component_padronizacao (×2),
--             supplier_customization_raw (×1).
--
-- [P2] SECURITY: fix mutable search_path on 2 public functions
--   fn_cron_guard and fn_xbz_site_collect have no fixed search_path, enabling
--   schema-injection if an attacker controls the session's search_path.
--   Neither is SECURITY DEFINER so risk is lower, but fixing is cheap.
--
-- [P3] PERF: add missing FK indexes on 8 core B2B tables
--   Unindexed foreign keys cause full-table scans on joins and cascade operations.
--   Using IF NOT EXISTS so the migration is idempotent on reset.

-- ============================================================================
-- [P0] Restrict get_edge_anon_key to service_role only
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.get_edge_anon_key() FROM authenticated;
-- postgres and service_role retain EXECUTE (those are the only callers that
-- should need the anon key from inside the DB, e.g. Edge Function bootstrap).

-- ============================================================================
-- [P1] Fix auth_rls_initplan — wrap auth.uid() in (SELECT auth.uid())
-- ============================================================================

-- kit_component_enrichment_raw — admin ALL policy
ALTER POLICY kcer_admin_all ON public.kit_component_enrichment_raw
  USING (is_admin_or_above((SELECT auth.uid())));

-- kit_component_enrichment_raw — authenticated read policy
ALTER POLICY kcer_read_auth ON public.kit_component_enrichment_raw
  USING ((SELECT auth.uid()) IS NOT NULL);

-- kit_component_padronizacao — admin ALL policy
ALTER POLICY kcpad_admin_write ON public.kit_component_padronizacao
  USING (is_admin_or_above((SELECT auth.uid())));

-- kit_component_padronizacao — authenticated read policy
ALTER POLICY kcpad_read_auth ON public.kit_component_padronizacao
  USING ((SELECT auth.uid()) IS NOT NULL);

-- supplier_customization_raw — admin read policy (two auth.uid() calls)
ALTER POLICY "Admins can read supplier customization raw" ON public.supplier_customization_raw
  USING (
    has_role((SELECT auth.uid()), 'admin'::app_role)
    OR is_dev((SELECT auth.uid()))
  );

-- ============================================================================
-- [P2] Fix mutable search_path on public functions
-- ============================================================================
ALTER FUNCTION public.fn_cron_guard(bigint, text) SET search_path = '';
ALTER FUNCTION public.fn_xbz_site_collect(integer) SET search_path = '';

-- ============================================================================
-- [P3] Add missing FK indexes on core B2B tables
-- All use IF NOT EXISTS — safe to run on a fresh db reset.
-- ============================================================================

-- quotes
CREATE INDEX IF NOT EXISTS idx_quotes_assigned_to      ON public.quotes(assigned_to);
CREATE INDEX IF NOT EXISTS idx_quotes_parent_quote_id  ON public.quotes(parent_quote_id);

-- mockup_generation_jobs
CREATE INDEX IF NOT EXISTS idx_mockup_gen_jobs_product_id   ON public.mockup_generation_jobs(product_id);
CREATE INDEX IF NOT EXISTS idx_mockup_gen_jobs_technique_id ON public.mockup_generation_jobs(technique_id);

-- markup_configurations
CREATE INDEX IF NOT EXISTS idx_markup_cfg_created_by     ON public.markup_configurations(created_by);
CREATE INDEX IF NOT EXISTS idx_markup_cfg_organization_id ON public.markup_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_markup_cfg_product_id      ON public.markup_configurations(product_id);
CREATE INDEX IF NOT EXISTS idx_markup_cfg_supplier_id     ON public.markup_configurations(supplier_id);

-- product_deactivation_requests
CREATE INDEX IF NOT EXISTS idx_pdr_approved_by   ON public.product_deactivation_requests(approved_by);
CREATE INDEX IF NOT EXISTS idx_pdr_rejected_by   ON public.product_deactivation_requests(rejected_by);
CREATE INDEX IF NOT EXISTS idx_pdr_requested_by  ON public.product_deactivation_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_pdr_supplier_id   ON public.product_deactivation_requests(supplier_id);

-- mockup_credit_transactions
CREATE INDEX IF NOT EXISTS idx_mct_credit_account_id ON public.mockup_credit_transactions(credit_account_id);
CREATE INDEX IF NOT EXISTS idx_mct_job_id            ON public.mockup_credit_transactions(job_id);
CREATE INDEX IF NOT EXISTS idx_mct_mockup_id         ON public.mockup_credit_transactions(mockup_id);

-- kit_comments
CREATE INDEX IF NOT EXISTS idx_kit_comments_kit_id    ON public.kit_comments(kit_id);
CREATE INDEX IF NOT EXISTS idx_kit_comments_parent_id ON public.kit_comments(parent_id);

-- b2b_collections
CREATE INDEX IF NOT EXISTS idx_b2b_collections_created_by      ON public.b2b_collections(created_by);
CREATE INDEX IF NOT EXISTS idx_b2b_collections_organization_id ON public.b2b_collections(organization_id);

-- media_sync_queue
CREATE INDEX IF NOT EXISTS idx_media_sync_queue_organization_id ON public.media_sync_queue(organization_id);
CREATE INDEX IF NOT EXISTS idx_media_sync_queue_supplier_id     ON public.media_sync_queue(supplier_id);
