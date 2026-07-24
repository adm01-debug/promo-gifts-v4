-- SEC: Add explicit policies to 42 tables with rls_enabled_no_policy (INFO)
--
-- Supabase linter lint=0008_rls_enabled_no_policy flagged 42 tables that have
-- RLS enabled but zero policies — all rows are blocked for every non-service_role
-- caller, which is usually a misconfiguration.
--
-- Three groups:
--   A) Partition tables: mirror parent's policies verbatim
--   B) Internal/pipeline/backup tables: admin-only ALL (non-admins stay blocked)
--   C) cf_recon schema: same admin-only pattern, fully-qualified function name
--
-- (SELECT auth.uid()) pattern used throughout — evaluated once per statement,
-- not once per row (auth_rls_initplan performance fix already applied).

-- ═══════════════════════════════════════════════════════════════════════════════
-- A) magazine_public_view_events partitions — mirror parent policies
-- ═══════════════════════════════════════════════════════════════════════════════

DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'magazine_public_view_events_2026_07',
    'magazine_public_view_events_2026_08',
    'magazine_public_view_events_2026_09',
    'magazine_public_view_events_2026_10',
    'magazine_public_view_events_default'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY view_events_service_all ON public.%I
         FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t
    );
    EXECUTE format(
      'CREATE POLICY view_events_read_admin ON public.%I
         FOR SELECT TO authenticated
         USING (has_role((SELECT auth.uid()), ''admin''::app_role))',
      t
    );
    EXECUTE format(
      'CREATE POLICY view_events_read_owner ON public.%I
         FOR SELECT TO authenticated
         USING (EXISTS (
           SELECT 1 FROM public.magazines m
           WHERE m.id = magazine_id
             AND m.owner_id = (SELECT auth.uid())
         ))',
      t
    );
  END LOOP;
END;
$do$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- A) supplier_products_raw_history partitions — mirror parent policies
-- ═══════════════════════════════════════════════════════════════════════════════

DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'supplier_products_raw_history_p2026_06',
    'supplier_products_raw_history_p2026_07',
    'supplier_products_raw_history_p2026_08',
    'supplier_products_raw_history_p2026_09',
    'supplier_products_raw_history_p2026_10'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY hist_all_service ON public.%I
         FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t
    );
    EXECUTE format(
      'CREATE POLICY hist_select_admin ON public.%I
         FOR SELECT TO authenticated
         USING (is_admin_or_above((SELECT auth.uid())))',
      t
    );
  END LOOP;
END;
$do$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- B) Internal / pipeline / backup tables in public schema — admin-only ALL
-- ═══════════════════════════════════════════════════════════════════════════════

DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    '_archive_product_ai_20260626',
    '_archive_product_seo_20260626',
    '_archive_supplier_price_tiers_20260626',
    '_bkp_kcvs_pre_normalize_20260624',
    '_bkp_kit_color_from_name_20260624',
    '_bkp_kit_packing_type_20260624',
    '_bkp_kit_pkg_material_20260624',
    '_qa_pct_results',
    'backup_produto_ramo_atividade_20260625',
    'cf_recon_inflight',
    'cron_job_timeout_map',
    'cron_watchdog_log',
    'eco_backfill_log_20260625',
    'eco_date_reconcile_log_20260626',
    'kit_component_ficha_staging',
    'kit_component_variant_skus',
    'kit_ficha_session_log',
    'magazine_view_rollup_watermark',
    'material_reconcile_log_20260626',
    'mcp_kv',
    'personalization_technique_mappings',
    'schema_signature_baseline',
    'schema_signature_drift_allowlist',
    'schema_signature_drift_log',
    'supplier_customization_raw',
    'webhook_delivery_locks'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY admin_only ON public.%I
         FOR ALL TO authenticated
         USING (is_admin_or_above((SELECT auth.uid())))
         WITH CHECK (is_admin_or_above((SELECT auth.uid())))',
      t
    );
  END LOOP;
END;
$do$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- C) cf_recon schema — admin-only ALL (fully-qualified function)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'action_log',
    'cf_ghost_check_queue',
    'cf_image',
    'crawl_run',
    'metric_snapshot',
    'remediation'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY admin_only ON cf_recon.%I
         FOR ALL TO authenticated
         USING (public.is_admin_or_above((SELECT auth.uid())))
         WITH CHECK (public.is_admin_or_above((SELECT auth.uid())))',
      t
    );
  END LOOP;
END;
$do$;

-- ─── Validate ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_still_no_policy integer;
BEGIN
  SELECT count(*) INTO v_still_no_policy
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND c.relrowsecurity = true
    AND n.nspname IN ('public', 'cf_recon')
    AND c.relname = ANY(ARRAY[
      'magazine_public_view_events_2026_07','magazine_public_view_events_2026_08',
      'magazine_public_view_events_2026_09','magazine_public_view_events_2026_10',
      'magazine_public_view_events_default',
      'supplier_products_raw_history_p2026_06','supplier_products_raw_history_p2026_07',
      'supplier_products_raw_history_p2026_08','supplier_products_raw_history_p2026_09',
      'supplier_products_raw_history_p2026_10',
      '_archive_product_ai_20260626','_archive_product_seo_20260626',
      '_archive_supplier_price_tiers_20260626','_bkp_kcvs_pre_normalize_20260624',
      '_bkp_kit_color_from_name_20260624','_bkp_kit_packing_type_20260624',
      '_bkp_kit_pkg_material_20260624','_qa_pct_results',
      'backup_produto_ramo_atividade_20260625','cf_recon_inflight',
      'cron_job_timeout_map','cron_watchdog_log','eco_backfill_log_20260625',
      'eco_date_reconcile_log_20260626','kit_component_ficha_staging',
      'kit_component_variant_skus','kit_ficha_session_log',
      'magazine_view_rollup_watermark','material_reconcile_log_20260626',
      'mcp_kv','personalization_technique_mappings','schema_signature_baseline',
      'schema_signature_drift_allowlist','schema_signature_drift_log',
      'supplier_customization_raw','webhook_delivery_locks',
      'action_log','cf_ghost_check_queue','cf_image','crawl_run',
      'metric_snapshot','remediation'
    ])
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname AND p.tablename = c.relname
    );

  IF v_still_no_policy > 0 THEN
    RAISE EXCEPTION 'rls_enabled_no_policy fix FAILED — % tables still have no policies', v_still_no_policy;
  END IF;

  RAISE NOTICE 'Policies added to 42 tables — rls_enabled_no_policy warnings resolved';
END;
$$;
