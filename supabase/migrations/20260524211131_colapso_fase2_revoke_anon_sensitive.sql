-- =============================================================
-- COLAPSO FASE 2 — REVOKE em 20 tabelas críticas (defesa em profundidade)
-- Estratégia conservadora: só REVOKE em tabelas que comprovadamente
-- são uso interno (credenciais, logs admin, tokens MFA).
-- Tabelas que podem ter uso público legítimo via token (kit_share_tokens,
-- quote_approval_tokens, etc.) PRESERVAM SELECT — RLS continua filtrando.
-- =============================================================

-- Credenciais e secrets (CRÍTICO)
REVOKE ALL ON public.integration_credentials FROM anon;
REVOKE ALL ON public.secret_rotation_log FROM anon;
REVOKE ALL ON public.mcp_api_keys FROM anon;
REVOKE ALL ON public.mcp_access_violations FROM anon;
REVOKE ALL ON public.mcp_key_auto_revocations FROM anon;
REVOKE ALL ON public.mcp_full_grantors FROM anon;

-- Step-up / 2FA / MFA
REVOKE ALL ON public.step_up_tokens FROM anon;
REVOKE ALL ON public.step_up_challenges FROM anon;
REVOKE ALL ON public.step_up_audit_log FROM anon;

-- Logs de auth / sec
REVOKE ALL ON public.auth_login_attempts FROM anon;
REVOKE ALL ON public.bot_detection_log FROM anon;
REVOKE ALL ON public.user_token_revocations FROM anon;

-- Admin / config interna
REVOKE ALL ON public.admin_audit_log FROM anon;
REVOKE ALL ON public.admin_settings FROM anon;
REVOKE ALL ON public.access_security_settings FROM anon;
REVOKE ALL ON public.security_settings FROM anon;

-- Logs internos
REVOKE ALL ON public.conversation_audit_logs FROM anon;
REVOKE ALL ON public.e2e_cleanup_rate_limit FROM anon;
REVOKE ALL ON public.seo_audit_log FROM anon;
REVOKE ALL ON public.webhook_delivery_metrics FROM anon;
