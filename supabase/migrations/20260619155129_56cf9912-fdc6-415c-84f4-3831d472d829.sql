DO $$
DECLARE
  r record;
  whitelist text[] := ARRAY[
    'has_role','has_org_role','get_user_org_ids','is_admin','is_admin_strict','is_dev',
    'is_manager_or_admin','is_supervisor_or_above','is_kit_owner','is_kit_collaborator',
    'is_org_member','is_seller_only','can_approve_discount','can_manage_quotes',
    'can_view_all_sales','can_view_audit_logs','can_view_connections','can_view_telemetry',
    'can_manage_connections',
    'get_bundle_suggestions','get_top_collected_products','get_top_favorited_products',
    'get_top_compared_products','get_user_recent_comparisons','get_collections_weekly_count',
    'get_favorites_weekly_count','get_client_top_products','get_client_seasonality',
    'get_industry_top_products','get_industry_benchmark_stats','ensure_default_favorite_list',
    'restore_favorite_from_trash','check_ai_quota','check_hardening_status',
    'can_grant_mcp_full','check_telemetry_regression','get_app_health_summary',
    'lookup_request_id','get_platform_failure_metrics','get_auto_test_job_status',
    'get_connection_failure_window_minutes','set_connection_failure_window_minutes',
    'get_connections_auto_test_interval','set_connections_auto_test_interval',
    'execute_role_migration_batch','record_dev_route_telemetry','log_rls_denial',
    'log_user_logout','repair_ownership_orphans','search_records_rerank','fn_my_rpc',
    'audit_security_definer_acl'
  ];
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND NOT (p.proname = ANY (whitelist))
      AND (has_function_privilege('authenticated', p.oid, 'EXECUTE')
        OR has_function_privilege('anon', p.oid, 'EXECUTE'))
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM authenticated, anon, PUBLIC',
                   r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',
                   r.proname, r.args);
  END LOOP;
END $$;