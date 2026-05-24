-- =============================================================
-- COLAPSO FASE 2 — ALTER ROLE timeouts + REVOKE sensíveis
-- Data: 2026-05-24
-- Contexto: análise forense identificou que `idle_session_timeout=0`
-- global criava conexões PostgREST zumbi por até 10 dias. Como ALTER
-- DATABASE para esse parâmetro é bloqueado em Supabase Cloud, aplicamos
-- por ROLE, que tem precedência semelhante.
--
-- Adicionalmente, 34 tabelas sensíveis (credenciais, tokens, audit logs)
-- tinham SELECT/INSERT/UPDATE/DELETE para `anon`, expondo a estrutura via
-- introspection do GraphQL e PostgREST mesmo com RLS ativa.
-- =============================================================

-- =============================================================
-- BLOCO 1 — Timeouts por role (substitui Dashboard idle_session_timeout)
-- =============================================================

-- authenticator: role-mãe do PostgREST. idle_session_timeout aqui força
-- limpeza de conexões zumbi do PostgREST que ficavam por dias.
ALTER ROLE authenticator SET idle_in_transaction_session_timeout = '60000';   -- 60s
ALTER ROLE authenticator SET idle_session_timeout = '600000';                  -- 10min

-- anon e authenticated herdam de authenticator, mas reforçamos:
ALTER ROLE anon SET idle_in_transaction_session_timeout = '30000';            -- 30s
ALTER ROLE authenticated SET idle_in_transaction_session_timeout = '60000';   -- 60s

-- service_role: edge functions e cron. 5min folgado.
ALTER ROLE service_role SET idle_in_transaction_session_timeout = '60000';
ALTER ROLE service_role SET idle_session_timeout = '300000';                   -- 5min

-- =============================================================
-- BLOCO 2 — REVOKE em 34 tabelas sensíveis (defesa em profundidade)
-- RLS protege os dados; REVOKE remove a tabela do schema introspection
-- do PostgREST e impede acesso mesmo se RLS for desabilitada por engano.
-- =============================================================

REVOKE ALL ON public.admissao_tokens FROM anon;
REVOKE ALL ON public.audit_log FROM anon;
REVOKE ALL ON public.audit_logs FROM anon;
REVOKE ALL ON public.auditoria FROM anon;
REVOKE ALL ON public.auditoria_contratual FROM anon;
REVOKE ALL ON public.auditoria_logs FROM anon;
REVOKE ALL ON public.auth_gov_br_sessions FROM anon;
REVOKE ALL ON public.blocked_ips FROM anon;
REVOKE ALL ON public.ferias_audit_log FROM anon;
REVOKE ALL ON public.folha_auditoria FROM anon;
REVOKE ALL ON public.folha_eventos_auditoria FROM anon;
REVOKE ALL ON public.geo_blocked_attempts FROM anon;
REVOKE ALL ON public.govbr_auth_state FROM anon;
REVOKE ALL ON public.login_attempts FROM anon;
REVOKE ALL ON public.login_rate_limits FROM anon;
REVOKE ALL ON public.password_history FROM anon;
REVOKE ALL ON public.password_policies FROM anon;
REVOKE ALL ON public.password_reset_config FROM anon;
REVOKE ALL ON public.password_reset_requests FROM anon;
REVOKE ALL ON public.ponto_auditoria FROM anon;
REVOKE ALL ON public.ponto_auditoria_fraude FROM anon;
REVOKE ALL ON public.provisao_auditoria FROM anon;
REVOKE ALL ON public.rate_limit_config FROM anon;
REVOKE ALL ON public.rate_limit_logs FROM anon;
REVOKE ALL ON public.rate_limits FROM anon;
REVOKE ALL ON public.security_alerts FROM anon;
REVOKE ALL ON public.trilha_auditoria_ponto FROM anon;
REVOKE ALL ON public.user_mfa FROM anon;
REVOKE ALL ON public.user_sessions FROM anon;
REVOKE ALL ON public.verification_tokens FROM anon;
REVOKE ALL ON public.webauthn_credentials FROM anon;
REVOKE ALL ON public.webhook_logs FROM anon;
REVOKE ALL ON public.webhooks FROM anon;
REVOKE ALL ON public.webhooks_config FROM anon;
REVOKE ALL ON public.webhooks_logs FROM anon;

-- =============================================================
-- VALIDAÇÃO (informativa, não falha)
-- =============================================================

DO $$
DECLARE
  v_count int;
BEGIN
  -- Conta quantas das tabelas sensíveis ainda têm SELECT para anon
  SELECT count(*) INTO v_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename = ANY(ARRAY[
      'admissao_tokens','audit_log','audit_logs','auditoria','auditoria_contratual',
      'auditoria_logs','auth_gov_br_sessions','blocked_ips','ferias_audit_log',
      'folha_auditoria','folha_eventos_auditoria','geo_blocked_attempts',
      'govbr_auth_state','login_attempts','login_rate_limits','password_history',
      'password_policies','password_reset_config','password_reset_requests',
      'ponto_auditoria','ponto_auditoria_fraude','provisao_auditoria',
      'rate_limit_config','rate_limit_logs','rate_limits','security_alerts',
      'trilha_auditoria_ponto','user_mfa','user_sessions','verification_tokens',
      'webauthn_credentials','webhook_logs','webhooks','webhooks_config','webhooks_logs'
    ])
    AND has_table_privilege('anon', schemaname||'.'||tablename, 'SELECT');

  IF v_count > 0 THEN
    RAISE WARNING 'Ainda há % tabelas sensíveis com SELECT exposto para anon', v_count;
  ELSE
    RAISE NOTICE '✅ Todas as tabelas sensíveis estão fechadas para anon';
  END IF;
END $$;
