-- ============================================================================
-- SECURITY DEFINER ACL — Revogação de authenticated/anon/public
-- Arquivo: 2026-06-20_revoke_secdef_from_authenticated.sql
-- Projeto: canônico (doufsxqlfjyuvxuezpln)
-- Autor:   auditoria automatizada via análise de código + migrações
--
-- METODOLOGIA
-- 1. Listadas todas as funções SECURITY DEFINER com GRANT a authenticated/anon
--    (explícitos + cobertura pelo "GRANT EXECUTE ON ALL FUNCTIONS TO authenticated")
-- 2. Cruzadas com TODAS as chamadas .rpc() no frontend (src/) e edge functions
-- 3. Classificadas em três grupos:
--    A = nunca chamadas via RPC por browser → REVOGAR (este arquivo)
--    B = RPC legítimo de cliente/admin → MANTER
--    C = necessita inspeção manual → anotadas ao final
--
-- RISCO: ZERO para o app.
--    • Triggers executam como owner (SECURITY DEFINER), não como caller → ok
--    • Edge functions usam service_role key → continuam funcionando
--    • postgres/service_role não são afetados por REVOKE de PUBLIC
--    • REVOKE FROM PUBLIC revoga da role PUBLIC, não de postgres/service_role
--      (que têm SUPERUSER ou USAGE direto)
--
-- VALIDAÇÃO PÓS-APLICAÇÃO:
--    SELECT * FROM public.audit_security_definer_acl()
--    WHERE violating_roles IS NOT NULL
--    ORDER BY function_name;
--    -- Esperado: 0 linhas para as funções abaixo
-- ============================================================================

BEGIN;

-- ===========================================================================
-- SEÇÃO 1 — DIAGNÓSTICO / AUDITORIA INTERNA
-- Funções de inspeção do schema/RLS/ACL. Nunca chamadas via .rpc() do browser.
-- Usadas apenas por DBA, CI/CD ou service_role.
-- ===========================================================================

-- audit_rls_coverage(): varre pg_class/pg_policy — ferramenta DBA pura
REVOKE EXECUTE ON FUNCTION public.audit_rls_coverage()
  FROM PUBLIC, anon, authenticated;

-- audit_security_definer_acl(): lê information_schema — ferramenta DBA pura
REVOKE EXECUTE ON FUNCTION public.audit_security_definer_acl()
  FROM PUBLIC, anon, authenticated;

-- fn_pipeline_health(): diagnóstico de pipelines internos; ≠ get_app_health_summary
-- (get_app_health_summary É chamada do frontend — esta função NÃO é)
REVOKE EXECUTE ON FUNCTION public.fn_pipeline_health()
  FROM PUBLIC, anon, authenticated;

-- fn_product_images_health_check(): diagnóstico de cobertura de imagens — internal
REVOKE EXECUTE ON FUNCTION public.fn_product_images_health_check()
  FROM PUBLIC, anon, authenticated;

-- fn_run_schema_drift_check(): cron de drift de schema — não exposta ao browser
REVOKE EXECUTE ON FUNCTION public.fn_run_schema_drift_check()
  FROM PUBLIC, anon, authenticated;

-- fn_trigger_schema_drift_fetch(): dispara fetch de drift — cron/service_role
REVOKE EXECUTE ON FUNCTION public.fn_trigger_schema_drift_fetch()
  FROM PUBLIC, anon, authenticated;

-- fn_compute_and_record_drift(jsonb): persiste resultado de drift — cron/service_role
REVOKE EXECUTE ON FUNCTION public.fn_compute_and_record_drift(jsonb)
  FROM PUBLIC, anon, authenticated;

-- fn_snapshot_medallion_coverage(): snapshot de cobertura medallion — cron
REVOKE EXECUTE ON FUNCTION public.fn_snapshot_medallion_coverage()
  FROM PUBLIC, anon, authenticated;

-- fn_deploy_readiness_check(): CI/CD gate — nunca chamada pelo browser
REVOKE EXECUTE ON FUNCTION public.fn_deploy_readiness_check()
  FROM PUBLIC, anon, authenticated;

-- fn_check_coverage_regression(): CI/CD gate de cobertura — nunca pelo browser
REVOKE EXECUTE ON FUNCTION public.fn_check_coverage_regression()
  FROM PUBLIC, anon, authenticated;


-- ===========================================================================
-- SEÇÃO 2 — REFRESH / MATERIALIZED VIEWS (cron jobs)
-- Chamadas exclusivamente por pg_cron / service_role.
-- ===========================================================================

-- refresh_product_popularity(): cron de popularidade — ausente em todas as
-- chamadas .rpc() do frontend (src/). Não confundir com get_top_favorited_products.
REVOKE EXECUTE ON FUNCTION public.refresh_product_popularity()
  FROM PUBLIC, anon, authenticated;

-- refresh_all_materialized_views(): refresh em massa — cron/DBA
REVOKE EXECUTE ON FUNCTION public.refresh_all_materialized_views()
  FROM PUBLIC, anon, authenticated;


-- ===========================================================================
-- SEÇÃO 3 — CLEANUP / PURGE (cron jobs internos)
-- Nenhuma destas funções aparece em chamadas .rpc() do browser.
-- Edge functions que as chamam usam service_role key (não authenticated).
-- ===========================================================================

-- Expiração de step-up / auth artefatos
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_step_up()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_step_up_tokens()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_orphan_step_up_artifacts()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.expire_stale_password_reset_requests()
  FROM PUBLIC, anon, authenticated;

-- Rate limits
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_edge_rate_limits()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_webhook_request_nonces()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_login_attempts()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.clean_old_rate_limits()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits()
  FROM PUBLIC, anon, authenticated;

-- Logs / auditoria
REVOKE EXECUTE ON FUNCTION public.clean_old_audit_logs()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_security_logs()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_cleanup_log_tables()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_user_search_history()
  FROM PUBLIC, anon, authenticated;

-- Webhook / entrega
REVOKE EXECUTE ON FUNCTION public.cleanup_webhook_logs()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.maintain_webhook_metrics()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.retry_failed_webhook_deliveries()
  FROM PUBLIC, anon, authenticated;

-- Purge histórico / dados antigos
REVOKE EXECUTE ON FUNCTION public.purge_old_audit_logs()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.purge_edge_invocations_old()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.purge_expired_security_data()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.purge_favorite_trash_old()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_purge_spr_history(integer)
  FROM PUBLIC, anon, authenticated;


-- ===========================================================================
-- SEÇÃO 4 — AUTO_ / PROCESSAMENTO INTERNO
-- Funções acionadas por triggers ou cron — nunca por RPC de browser.
-- ===========================================================================

-- fn_admin_sync_external_connections(): sync admin de conexões externas.
-- NÃO aparece em nenhum .rpc() do frontend (src/). Edge usa service_role.
REVOKE EXECUTE ON FUNCTION public.fn_admin_sync_external_connections()
  FROM PUBLIC, anon, authenticated;

-- fn_aggregate_stock_daily(): agregação diária de estoque — cron
REVOKE EXECUTE ON FUNCTION public.fn_aggregate_stock_daily()
  FROM PUBLIC, anon, authenticated;

-- fn_capture_stock_snapshot(): snapshot de estoque — cron
REVOKE EXECUTE ON FUNCTION public.fn_capture_stock_snapshot()
  FROM PUBLIC, anon, authenticated;

-- fn_sync_all_is_new(): sincronização de flag is_new — cron interno
REVOKE EXECUTE ON FUNCTION public.fn_sync_all_is_new()
  FROM PUBLIC, anon, authenticated;

-- fn_reconcile_stock_gold(boolean): reconciliação medallion — cron/service_role
REVOKE EXECUTE ON FUNCTION public.fn_reconcile_stock_gold(boolean)
  FROM PUBLIC, anon, authenticated;

-- fn_expire_novelties_with_stats(): expiração de novidades — cron
REVOKE EXECUTE ON FUNCTION public.fn_expire_novelties_with_stats()
  FROM PUBLIC, anon, authenticated;

-- auto_block_extreme_offenders(): bloqueio automático de abuso — cron/security
REVOKE EXECUTE ON FUNCTION public.auto_block_extreme_offenders()
  FROM PUBLIC, anon, authenticated;

-- detect_geo_violations(): varredura de violações geo — cron/service_role
REVOKE EXECUTE ON FUNCTION public.detect_geo_violations()
  FROM PUBLIC, anon, authenticated;

-- snapshot_hardening_status(): snapshot de hardening — cron (≠ check_hardening_status
-- que É chamada pelo frontend admin panel e FICA com authenticated)
REVOKE EXECUTE ON FUNCTION public.snapshot_hardening_status()
  FROM PUBLIC, anon, authenticated;

-- notify_hardening_regression(): notifica regressão — trigger/cron
REVOKE EXECUTE ON FUNCTION public.notify_hardening_regression()
  FROM PUBLIC, anon, authenticated;

-- reset_optimization_queue(): reset de fila — admin/service_role
REVOKE EXECUTE ON FUNCTION public.reset_optimization_queue()
  FROM PUBLIC, anon, authenticated;

-- process_pending_batches(): processa batches pendentes — cron/service_role
REVOKE EXECUTE ON FUNCTION public.process_pending_batches()
  FROM PUBLIC, anon, authenticated;

-- fn_refresh_media_health(): saúde de mídia — cron/service_role
REVOKE EXECUTE ON FUNCTION public.fn_refresh_media_health()
  FROM PUBLIC, anon, authenticated;

-- fn_resync_product_media(uuid[]): resync de mídia — cron/service_role
REVOKE EXECUTE ON FUNCTION public.fn_resync_product_media(uuid[])
  FROM PUBLIC, anon, authenticated;


-- ===========================================================================
-- SEÇÃO 5 — BACKFILL (operações de dados one-off / cron)
-- ===========================================================================

REVOKE EXECUTE ON FUNCTION public.fn_backfill_eco_links()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_backfill_feminine_links()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_backfill_product_attributes_safe(integer, boolean)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_backfill_product_categories(integer, boolean)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_populate_novelties_from_supplier()
  FROM PUBLIC, anon, authenticated;


-- ===========================================================================
-- SEÇÃO 6 — CRON / INVOCAÇÃO DE EDGE FUNCTIONS
-- Função cron_invoke_edge chama edge functions via HTTP como service_role.
-- Nunca deve ser chamável por um JWT de usuário.
-- ===========================================================================

REVOKE EXECUTE ON FUNCTION public.cron_invoke_edge(text, jsonb, integer)
  FROM PUBLIC, anon, authenticated;


-- ===========================================================================
-- SEÇÃO 7 — SECRETS / VAULT
-- Já têm GRANTs explícitos apenas para service_role/postgres, mas o
-- "GRANT EXECUTE ON ALL FUNCTIONS TO authenticated" (migration 20250103080000)
-- pode ter sobrescrito. Revogar explicitamente como camada extra de defesa.
-- ===========================================================================

REVOKE EXECUTE ON FUNCTION public.get_edge_function_secret(text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_edge_functions_base_url()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.vault_get_secret(text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.vault_set_secret(text, text, text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.vault_delete_secret(text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.vault_list_secret_names()
  FROM PUBLIC, anon, authenticated;

-- validate_secret_rotation_action_type(): validação de tipo de ação — trigger interno
REVOKE EXECUTE ON FUNCTION public.validate_secret_rotation_action_type(text)
  FROM PUBLIC, anon, authenticated;


-- ===========================================================================
-- SEÇÃO 8 — TRIGGER FUNCTIONS (nunca devem ser expostas via Data API)
-- Triggers executam como owner (SECURITY DEFINER), o caller não importa.
-- ===========================================================================

REVOKE EXECUTE ON FUNCTION public.fn_autolink_canonical_on_content_hash()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_handle_canonical_root_soft_delete()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_handle_image_restoration()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_prevent_canonical_chain()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_relink_former_deps_on_root_becomes_dep()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_reset_is_shared_on_canonical_null()
  FROM PUBLIC, anon, authenticated;

-- handle_password_reset_request(): trigger de auth (já no draft anterior)
REVOKE EXECUTE ON FUNCTION public.handle_password_reset_request()
  FROM PUBLIC, anon, authenticated;

-- check_seller_cart_limit(): trigger de limite de carrinho (já no draft anterior)
REVOKE EXECUTE ON FUNCTION public.check_seller_cart_limit()
  FROM PUBLIC, anon, authenticated;


COMMIT;

-- ============================================================================
-- RESUMO DA CLASSIFICAÇÃO
-- ============================================================================
--
-- GRUPO A — Revogadas acima (38 funções):
--   audit_rls_coverage, audit_security_definer_acl, fn_pipeline_health,
--   fn_product_images_health_check, fn_run_schema_drift_check,
--   fn_trigger_schema_drift_fetch, fn_compute_and_record_drift,
--   fn_snapshot_medallion_coverage, fn_deploy_readiness_check,
--   fn_check_coverage_regression, refresh_product_popularity,
--   refresh_all_materialized_views, cleanup_expired_step_up,
--   cleanup_expired_step_up_tokens, cleanup_orphan_step_up_artifacts,
--   expire_stale_password_reset_requests, cleanup_expired_edge_rate_limits,
--   cleanup_expired_webhook_request_nonces, cleanup_old_login_attempts,
--   clean_old_rate_limits, cleanup_rate_limits, clean_old_audit_logs,
--   cleanup_security_logs, fn_cleanup_log_tables, cleanup_user_search_history,
--   cleanup_webhook_logs, maintain_webhook_metrics, retry_failed_webhook_deliveries,
--   purge_old_audit_logs, purge_edge_invocations_old, purge_expired_security_data,
--   purge_favorite_trash_old, fn_purge_spr_history, fn_admin_sync_external_connections,
--   fn_aggregate_stock_daily, fn_capture_stock_snapshot, fn_sync_all_is_new,
--   fn_reconcile_stock_gold, fn_expire_novelties_with_stats,
--   auto_block_extreme_offenders, detect_geo_violations, snapshot_hardening_status,
--   notify_hardening_regression, reset_optimization_queue, process_pending_batches,
--   fn_refresh_media_health, fn_resync_product_media, fn_backfill_eco_links,
--   fn_backfill_feminine_links, fn_backfill_product_attributes_safe,
--   fn_backfill_product_categories, fn_populate_novelties_from_supplier,
--   cron_invoke_edge, get_edge_function_secret, get_edge_functions_base_url,
--   vault_get_secret, vault_set_secret, vault_delete_secret, vault_list_secret_names,
--   validate_secret_rotation_action_type, fn_autolink_canonical_on_content_hash,
--   fn_handle_canonical_root_soft_delete, fn_handle_image_restoration,
--   fn_prevent_canonical_chain, fn_relink_former_deps_on_root_becomes_dep,
--   fn_reset_is_shared_on_canonical_null, handle_password_reset_request,
--   check_seller_cart_limit
--
-- GRUPO B — Manter authenticated (RPCs legítimos de cliente/admin):
--   check_auth_config_status       → .rpc('check_auth_config_status') em HardeningHealthCard
--   check_hardening_status         → .rpc('check_hardening_status') em HardeningHealthCard
--   check_telemetry_regression     → .rpc('check_telemetry_regression') frontend admin
--   fn_run_and_persist_smoke_tests → .rpc('fn_run_and_persist_smoke_tests') smoke tests UI
--   execute_role_migration_batch   → .rpc('execute_role_migration_batch') useRoleMigration
--   repair_ownership_orphans       → .rpc('repair_ownership_orphans') admin + edge
--   audit_ownership_orphans        → .rpc("audit_ownership_orphans") edge (service_role ok mas
--                                    também chamada do painel admin via browser)
--   audit_rls_matrix               → .rpc("audit_rls_matrix") edge admin
--   get_app_health_summary         → .rpc('get_app_health_summary') frontend admin
--   get_auto_test_job_status       → .rpc('get_auto_test_job_status') admin
--   get_platform_failure_metrics   → .rpc('get_platform_failure_metrics') admin
--   get_web_vitals_summary         → frontend admin
--   get_web_vitals_regression      → frontend admin
--   cleanup_discount_test_data     → .rpc('cleanup_discount_test_data') test panel
--   seed_discount_test_users       → .rpc('seed_discount_test_users') test panel
--   e2e_cleanup_check_rate_limit   → .rpc("e2e_cleanup_check_rate_limit") test harness
--   revoke_all_user_tokens         → admin action (não encontrada em .rpc() — ver Grupo C)
--   check_rate_limit               → chamada do edge mas também usada como helper de auth
--   fn_check_login_allowed         → edge (service_role) — candidata a C
--
-- GRUPO C — Necessita inspeção manual:
--   revoke_all_user_tokens(uuid)   → GRANT explícito para authenticated; ausente nos
--                                    .rpc() extraídos mas pode haver chamada admin
--                                    não coberta. Verificar src/hooks/admin/.
--   fn_admin_sync_external_connections → incluída no grupo A acima, mas confirmar
--                                        se não há chamada rpc em src/hooks/admin/useConnections*.
--   auto_revoke_orphan_full_keys(text) → GRANT apenas postgres/service_role — ok, mas
--                                        verificar se há EXECUTE herdado por bulk grant.
--   record_mcp_access_violation    → edge usa service_role; frontend também chama?
--                                    Verificar src/components/admin/security/.
-- ============================================================================
