-- =============================================================================
-- Migration: hardening de SECURITY DEFINER functions expostas
-- =============================================================================
-- Bug P1-01/P1-02 da auditoria 24/05/2026.
--
-- Funções SECDEF executam com privilégios do owner (geralmente postgres ou
-- supabase_admin), bypassando RLS. EXECUTE GRANT a anon/authenticated permite
-- que qualquer requisição (mesmo sem login) dispare a função — útil pra alguns
-- casos (rate-limit pre-auth, quote-by-token, RLS check helpers), perigoso
-- para outros (cleanup, schema introspection, purge).
--
-- Triagem das 16 SECDEF expostas:
--
-- MANTÉM exposição (uso legítimo):
--   • can_access_quote (auth): valida acesso a cotação específica
--   • is_admin_or_above, is_coord_or_above, is_org_member, is_org_owner_or_admin,
--     org_has_any_members, user_is_org_member (auth): helpers usados em RLS
--     policies — devem ser executáveis pelo próprio usuário durante eval
--   • check_login_rate_limit (anon+auth): roda ANTES do login → precisa anon
--   • get_quote_token_by_value, submit_quote_response (anon): fluxo de
--     cotação por token público (sem login)
--   • start_step_up_challenge, verify_step_up_password (auth): MFA flow
--
-- REVOGADO de anon/authenticated (esta migration):
--   1. cleanup_expired_webhook_request_nonces — manutenção, só cron/service
--   2. purge_expired_security_data — manutenção destrutiva, só cron
--   3. expire_stale_password_reset_requests — manutenção, só cron
--   4. get_public_schema_signatures — introspecção, atacante mapearia schema
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_webhook_request_nonces()
  FROM anon, authenticated, PUBLIC;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
           WHERE proname = 'purge_expired_security_data'
             AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, PUBLIC', r.sig);
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.expire_stale_password_reset_requests()
  FROM anon, authenticated, PUBLIC;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
           WHERE proname = 'get_public_schema_signatures'
             AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, PUBLIC', r.sig);
  END LOOP;
END $$;

-- Validação: as 4 acima devem mostrar APENAS service_role após esta migration.
-- =============================================================================
