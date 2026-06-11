-- p2_acl_01: restaura EXECUTE de RPCs admin consumidas diretamente pelo frontend
--
-- Contexto (auditoria integração frontend↔medallion 2026-06-11): os lockdowns de
-- ACL deixaram 4 RPCs chamadas pela UI admin sem EXECUTE para authenticated,
-- quebrando silenciosamente (42501):
--
--   - check_hardening_status()        → HardeningHealthCard
--   - check_telemetry_regression()    → useRegressionGuardrail / useOptimizationQueue
--   - lookup_request_id(text)         → useAppHealth (drill-down de request_id)
--   - execute_role_migration_batch()  → useRoleMigration
--
-- Todas têm checagem de autorização INTERNA (admin/dev via user_roles/has_role),
-- portanto reexpor a authenticated é seguro: não-admins recebem exceção da
-- própria função, não acesso.
--
-- NÃO reexpostas (decisão deliberada):
--   - repair_ownership_orphans: o teste de segurança do frontend
--     (src/utils/security-audit.ts) EXIGE permission denied para authenticated;
--     a execução real é via edge function ownership-repair (service_role).
--   - sync_external_connections_from_credentials: SECURITY DEFINER sem checagem
--     de chamador — ganha wrapper admin-gated em migration própria (183200).

-- check_hardening_status lê storage.buckets e cron.job; como SECURITY INVOKER,
-- authenticated falharia ao tocar cron.* mesmo sendo admin. Vira DEFINER com a
-- checagem interna de admin já existente + search_path travado (todas as
-- referências do corpo são schema-qualificadas; verificado em 2026-06-11).
ALTER FUNCTION public.check_hardening_status() SECURITY DEFINER;
ALTER FUNCTION public.check_hardening_status() SET search_path = '';
REVOKE ALL ON FUNCTION public.check_hardening_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_hardening_status() FROM anon;
GRANT EXECUTE ON FUNCTION public.check_hardening_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_hardening_status() TO service_role;

REVOKE ALL ON FUNCTION public.check_telemetry_regression() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_telemetry_regression() FROM anon;
GRANT EXECUTE ON FUNCTION public.check_telemetry_regression() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_telemetry_regression() TO service_role;

REVOKE ALL ON FUNCTION public.lookup_request_id(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lookup_request_id(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.lookup_request_id(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_request_id(text) TO service_role;

REVOKE ALL ON FUNCTION public.execute_role_migration_batch(text, text, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_role_migration_batch(text, text, jsonb, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.execute_role_migration_batch(text, text, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_role_migration_batch(text, text, jsonb, boolean) TO service_role;
