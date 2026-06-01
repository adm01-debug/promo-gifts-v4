-- =============================================================
-- FASE 2 — REVOKE SELECT FROM anon em tabelas sensíveis
-- Contexto: análise forense do colapso 2026-05-24 revelou 35 tabelas
-- contendo credenciais/tokens/logs de auth expostas via GraphQL/PostgREST
-- para anon. RLS protege os dados, mas o REVOKE é defesa em profundidade
-- e remove a tabela da introspection schema do PostgREST.
-- (Guarda IF EXISTS: a lista inclui tabelas de outros projetos; só atua nas presentes.)
-- =============================================================

DO $$
DECLARE
  tbl text;
  sensitive_tables text[] := ARRAY[
    'admissao_tokens',
    'audit_log',
    'audit_logs',
    'auditoria',
    'auditoria_contratual',
    'auditoria_logs',
    'auth_gov_br_sessions',
    'blocked_ips',
    'ferias_audit_log',
    'folha_auditoria',
    'folha_eventos_auditoria',
    'geo_blocked_attempts',
    'govbr_auth_state',
    'login_attempts',
    'login_rate_limits',
    'password_history',
    'password_policies',
    'password_reset_config',
    'password_reset_requests',
    'ponto_auditoria',
    'ponto_auditoria_fraude',
    'provisao_auditoria',
    'rate_limit_config',
    'rate_limit_logs',
    'rate_limits',
    'security_alerts',
    'trilha_auditoria_ponto',
    'user_mfa',
    'user_sessions',
    'verification_tokens',
    'webauthn_credentials',
    'webhook_logs',
    'webhooks',
    'webhooks_config',
    'webhooks_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY sensitive_tables LOOP
    -- Só REVOKE se a tabela existe (defensive)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=tbl) THEN
      EXECUTE format('REVOKE SELECT, INSERT, UPDATE, DELETE ON public.%I FROM anon', tbl);
      RAISE NOTICE 'REVOKE anon ON public.%', tbl;
    END IF;
  END LOOP;
END $$;

-- Verificação pós-aplicação
SELECT
  schemaname, tablename,
  has_table_privilege('anon', schemaname||'.'||tablename, 'SELECT') AS anon_still_has_select
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('password_reset_requests','user_mfa','webauthn_credentials','rate_limits','audit_log');
