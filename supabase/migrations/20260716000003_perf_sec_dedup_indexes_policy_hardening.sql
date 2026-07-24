-- EXEC-8: Dedup indexes, missing FK indexes, policy consolidation & hardening
--
-- (A) Drop 4 exact duplicate indexes on kit_component tables (same column, no WHERE diff)
-- (B) Create 2 missing FK indexes on magazine_templates + magazines
-- (C) Remove superseded SELECT policy on product_views (was covered by two specific ones)
-- (D) Harden 3 USING(true) ALL policies for `authenticated` on QA/reference tables

-- ─── (A) Drop exact duplicate indexes ────────────────────────────────────────
-- Long-name auto-generated duplicates of the short idx_kcer_* / idx_kcpad_* aliases.
DROP INDEX IF EXISTS public.idx_kit_component_enrichment_raw_kit_product_id;
DROP INDEX IF EXISTS public.idx_kit_component_enrichment_raw_kit_component_id;
DROP INDEX IF EXISTS public.idx_kit_component_padronizacao_kit_product_id;
DROP INDEX IF EXISTS public.idx_kit_component_padronizacao_kit_component_id;

-- ─── (B) Missing FK indexes ───────────────────────────────────────────────────
-- FK joins on template_id were doing sequential scans on parent tables.
CREATE INDEX IF NOT EXISTS idx_magazine_templates_template_id
  ON public.magazine_templates (template_id);

CREATE INDEX IF NOT EXISTS idx_magazines_template_id
  ON public.magazines (template_id);

-- ─── (C) Consolidate product_views SELECT policies ───────────────────────────
-- "Users can view own views" (is_admin OR seller_id) is superseded by the two
-- explicit policies created in migration 000002 (admin via has_role, own via seller_id).
-- Keeping three permissive SELECT policies forces PG to evaluate all three per row.
DROP POLICY IF EXISTS "Users can view own views" ON public.product_views;

-- ─── (D) Fix USING(true)/WITH CHECK(true) ALL for authenticated role ──────────
-- These granted any authenticated user full DML on reference/QA tables.
-- Pattern: split into SELECT-for-all + ALL-for-admin.

-- color_synonym_map ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS rls_authenticated_all_color_synonym_map ON public.color_synonym_map;
-- Read: same as anon (already has rls_anon_read_color_synonym_map)
CREATE POLICY csm_read_authenticated ON public.color_synonym_map
  FOR SELECT TO authenticated
  USING (true);
-- Write: admin only
CREATE POLICY csm_write_admin ON public.color_synonym_map
  FOR ALL TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));

-- product_qa_image_alerts ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS rls_authenticated_all_qa_alerts ON public.product_qa_image_alerts;
CREATE POLICY qa_alerts_read_authenticated ON public.product_qa_image_alerts
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY qa_alerts_write_admin ON public.product_qa_image_alerts
  FOR ALL TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));

-- qa_image_coverage_log ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS rls_authenticated_all_qa_coverage_log ON public.qa_image_coverage_log;
CREATE POLICY qa_coverage_read_authenticated ON public.qa_image_coverage_log
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY qa_coverage_write_admin ON public.qa_image_coverage_log
  FOR ALL TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (is_admin_or_above((SELECT auth.uid())));
