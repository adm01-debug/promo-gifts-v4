-- =============================================================
-- COLAPSO FASE 2 - REVOKE em 20 tabelas criticas
--
-- Defesa em profundidade: remove anon das tabelas internas quando elas
-- existem. O guard por to_regclass mantem o replay limpo funcionando em
-- ambientes onde uma tabela opcional ainda nao foi criada.
-- =============================================================

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    -- Credenciais e secrets
    'integration_credentials',
    'secret_rotation_log',
    'mcp_api_keys',
    'mcp_access_violations',
    'mcp_key_auto_revocations',
    'mcp_full_grantors',

    -- Step-up / 2FA / MFA
    'step_up_tokens',
    'step_up_challenges',
    'step_up_audit_log',

    -- Logs de auth / sec
    'auth_login_attempts',
    'bot_detection_log',
    'user_token_revocations',

    -- Admin / config interna
    'admin_audit_log',
    'admin_settings',
    'access_security_settings',
    'security_settings',

    -- Logs internos
    'conversation_audit_logs',
    'e2e_cleanup_rate_limit',
    'seo_audit_log',
    'webhook_delivery_metrics'
  ]
  LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE NOTICE '[colapso_fase2] Skipped anon revoke: public.% does not exist', v_table;
    ELSE
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', v_table);
    END IF;
  END LOOP;
END $$;
