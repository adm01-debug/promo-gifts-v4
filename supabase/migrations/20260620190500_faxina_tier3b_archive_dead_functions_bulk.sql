-- FAXINA DB — Tier 3b: bulk-archive provably-dead FUNCTIONS (reversible: ALTER FUNCTION ... SET SCHEMA).
--
-- Applied to production (doufsxqlfjyuvxuezpln) on 2026-06-20 via Supabase MCP apply_migration.
-- This file mirrors the applied migration so repo == database.
-- Continuation of docs/FAXINA_DB_2026-06-20_TIER3.md (the "~570 remaining" set). Archived 466 functions
-- (public functions 1142 -> 676). See docs/FAXINA_DB_2026-06-20_TIER3B.md.
--
-- Selection (ALL must hold, RE-VERIFIED at runtime per function):
--   * not extension-owned; not in the repo keep-list below (.rpc()/string refs in src+functions+tests+e2e+scripts)
--   * 0 structural dependents in pg_depend (triggers/policies/views/defaults/constraints/generated cols)
--   * 0 references in any other public function body; 0 references in cron commands
--   * 0 references in any RLS policy expression; not an attached trigger function (defense in depth)
-- Per-function error isolation; idempotent (skips name+signature collisions already in archive).
-- Rollback: scripts/faxina-rollback.sql (session='claude-faxina-2026-06-20').
do $$
declare
  r record; moved int := 0; skipped int := 0;
  keep text[] := string_to_array(
'acquire_ai_quota audit_user_role_changes auto_revoke_orphan_full_keys can_manage_connections can_view_connections can_view_telemetry check_edge_rate_limit check_hardening_status check_ip_access check_rate_limit check_telemetry_regression claim_next_optimization cleanup_discount_test_data cleanup_expired_novelties cleanup_old_logs cleanup_old_notifications cleanup_webhook_logs complete_optimization consume_step_up_token e2e_cleanup_check_rate_limit enqueue_optimization execute_role_migration_batch fn_admin_sync_external_connections fn_get_customization_price fn_get_low_stock_alerts fn_get_novelty_alerts fn_get_product_ai_context fn_get_product_customization_options fn_get_reposicao_variants_summary fn_get_stock_notification_counts fn_get_stockout_alerts fn_global_search fn_should_apply_kill_switch get_active_commemorative_dates get_all_material_groups_safe get_all_material_types_safe get_app_health_summary get_auto_test_job_status get_bundle_suggestions get_category_descendants get_client_seasonality get_client_top_products get_collections_weekly_count get_connection_failure_window_minutes get_connections_auto_test_interval get_favorite_list_counts get_favorites_weekly_count get_industry_benchmark_stats get_industry_seasonality get_industry_top_products get_material_types_by_group_slug get_materials_complete_safe get_platform_failure_metrics get_top_collected_products get_top_compared_products get_top_favorited_products get_upcoming_commemorative_dates get_user_org_ids get_user_recent_comparisons get_variants_for_commemorative_date increment_kit_template_usage increment_webhook_stats is_dnd_active log_access_denied log_full_scope_grant log_rls_denial log_user_logout lookup_request_id mark_step_up_password_verified prevent_profile_role_change prevent_role_self_update record_dev_route_telemetry register_ai_routing_decision repair_ownership_orphans request_step_up_challenge reset_optimization_queue restore_favorite_from_trash retry_failed_webhook_deliveries revoke_all_user_tokens search_products_semantic search_records_rerank seed_discount_test_users send_digest_notification set_connection_failure_window_minutes set_connections_auto_test_interval update_quote_transactional validate_discount_approval_status validate_mcp_key verify_step_up_otp',' ');
begin
  create schema if not exists archive;
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f'
      and not (p.proname = any(keep))
      and not exists (select 1 from pg_depend e where e.objid=p.oid and e.deptype='e')
      and not exists (select 1 from pg_depend d where d.refobjid=p.oid and d.deptype in ('n','a') and d.classid<>'pg_proc'::regclass)
      and not exists (select 1 from pg_proc p2 join pg_namespace n2 on n2.oid=p2.pronamespace where n2.nspname='public' and p2.oid<>p.oid and p2.prosrc ~ ('\m'||p.proname||'\M'))
      and not exists (select 1 from cron.job j where j.command ~ ('\m'||p.proname||'\M'))
      and not exists (select 1 from pg_policies pol where coalesce(pol.qual,'')~('\m'||p.proname||'\M') or coalesce(pol.with_check,'')~('\m'||p.proname||'\M'))
      and not exists (select 1 from pg_trigger t where t.tgfoid=p.oid and not t.tgisinternal)
  loop
    if exists (select 1 from pg_proc ap join pg_namespace an on an.oid=ap.pronamespace
               where an.nspname='archive' and ap.proname=r.proname and pg_get_function_identity_arguments(ap.oid)=r.args) then
      raise notice 'SKIP %(%) collision', r.proname, r.args; skipped:=skipped+1; continue; end if;
    begin
      execute format('alter function public.%I(%s) set schema archive', r.proname, r.args);
      insert into archive._cleanup_manifest(object_type,object_name,reason,evidence,session)
      values ('function', r.proname||'('||r.args||')',
              'tier3b dead fn: 0 db refs (deps/fnbody/cron/policy/trigger) + 0 repo refs',
              jsonb_build_object('phase','tier3b_function','secdef',r.prosecdef),'claude-faxina-2026-06-20');
      moved := moved + 1;
    exception when others then
      raise notice 'SKIP %(%) err: %', r.proname, r.args, sqlerrm; skipped:=skipped+1;
    end;
  end loop;
  raise notice 'Tier3b archived % functions (skipped %)', moved, skipped;
end $$;
NOTIFY pgrst, 'reload schema';
