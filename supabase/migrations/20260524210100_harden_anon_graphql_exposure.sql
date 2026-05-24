-- Hardening de exposição GraphQL/PostgREST ao role `anon` (colapso 2026-05-24, fase C).
--
-- Os security advisors do Supabase apontaram ~374 objetos SELECT-áveis por `anon`
-- (lints 0026/0027). Embora todas as tabelas tenham RLS, o grant + a visibilidade
-- no schema GraphQL expõem desnecessariamente tabelas internas de log/auditoria/
-- telemetria/webhook/rate-limit. Removemos o SELECT do `anon` nessas tabelas
-- (defesa em profundidade — a RLS continua protegendo o dado).
--
-- IMPORTANTE — NÃO mexemos em:
--   * public.system_kill_switches  → o helper _shared/kill_switch.ts lê via anon key
--                                     (policy pública). Revogar quebraria o kill-switch.
--   * quote_approval_tokens, kit_share_tokens, public_token_failures, v_product_tokens,
--     user_filter_presets          → podem lastrear fluxos anônimos legítimos.
--                                     Ficam para revisão fluxo-a-fluxo numa próxima onda.
--   * role `authenticated`         → mantido; dashboards admin leem logs via JWT + RLS.
--
-- NOTA DE REPLAY: várias destas tabelas foram criadas fora do versionamento
-- (dashboard/Lovable) e não têm CREATE TABLE no repo. Por isso o REVOKE é defensivo
-- (só executa se a tabela existir via to_regclass) — assim a migration é idempotente
-- e não quebra um replay limpo (`supabase start` / rebuild) nem um `db push`.
--
-- Rollback: GRANT SELECT ON public.<tabela> TO anon;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    '_unif_pending_log','ai_usage_logs','api_usage','audit_log_gravacao',
    'edge_rate_limits','enrichment_log','external_connections_sync_log','file_scan_logs',
    'frontend_telemetry','image_import_log','image_validation_log','inbound_webhook_endpoints',
    'inbound_webhook_events','media_sync_log','outbound_webhooks','ownership_audit_reports',
    'ownership_repair_logs','product_search_logs','product_sync_logs','query_telemetry',
    'request_rate_limits','rls_denial_log','schema_drift_log','user_known_devices',
    'video_validation_log','voice_command_logs','webhook_deliveries'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE SELECT ON public.%I FROM anon', t);
    ELSE
      RAISE NOTICE 'harden_anon_graphql_exposure: tabela public.% ausente — REVOKE pulado', t;
    END IF;
  END LOOP;
END $$;
