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
--     user_filter_presets          → podem lastrear fluxos anônimos legítimos
--                                     (aprovação pública de cotação, kit compartilhado).
--                                     Ficam para revisão fluxo-a-fluxo numa próxima onda.
--   * role `authenticated`         → mantido; dashboards admin leem logs via JWT + RLS.
--                                     Revogar de authenticated quebraria o admin.
--
-- Rollback: GRANT SELECT ON public.<tabela> TO anon;

DO $g$ BEGIN REVOKE SELECT ON public._unif_pending_log              FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.ai_usage_logs                  FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.api_usage                      FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.audit_log_gravacao             FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.edge_rate_limits               FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.enrichment_log                 FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.external_connections_sync_log  FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.file_scan_logs                 FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.frontend_telemetry             FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.image_import_log               FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.image_validation_log           FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.inbound_webhook_endpoints      FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.inbound_webhook_events         FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.media_sync_log                 FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.outbound_webhooks              FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.ownership_audit_reports        FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.ownership_repair_logs          FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.product_search_logs            FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.product_sync_logs              FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.query_telemetry                FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.request_rate_limits            FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.rls_denial_log                 FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.schema_drift_log               FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.user_known_devices             FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.video_validation_log           FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.voice_command_logs             FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
DO $g$ BEGIN REVOKE SELECT ON public.webhook_deliveries             FROM anon; EXCEPTION WHEN undefined_table THEN NULL; END $g$;
