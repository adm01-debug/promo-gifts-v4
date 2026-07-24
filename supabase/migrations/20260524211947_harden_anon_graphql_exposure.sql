DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    '_unif_pending_log',
    'ai_usage_logs',
    'api_usage',
    'audit_log_gravacao',
    'edge_rate_limits',
    'enrichment_log',
    'external_connections_sync_log',
    'file_scan_logs',
    'frontend_telemetry',
    'image_import_log',
    'image_validation_log',
    'inbound_webhook_endpoints',
    'inbound_webhook_events',
    'media_sync_log',
    'outbound_webhooks',
    'ownership_audit_reports',
    'ownership_repair_logs',
    'product_search_logs',
    'product_sync_logs',
    'query_telemetry',
    'request_rate_limits',
    'rls_denial_log',
    'schema_drift_log',
    'user_known_devices',
    'video_validation_log',
    'voice_command_logs',
    'webhook_deliveries'
  ]
  LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE NOTICE '[harden_anon_graphql_exposure] Skipped anon revoke: public.% does not exist', v_table;
    ELSE
      EXECUTE format('REVOKE SELECT ON TABLE public.%I FROM anon', v_table);
    END IF;
  END LOOP;
END $$;
