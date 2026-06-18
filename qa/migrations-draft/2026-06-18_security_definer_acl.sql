-- =============================================================================
-- DRAFT MIGRATION — REQUIRES PO APPROVAL BEFORE APPLYING
-- =============================================================================
-- Target DB: doufsxqlfjyuvxuezpln (canonical Gold — NOT pqp)
-- Origin   : qa/AUDIT_2026-06-18-FULL.md item 1 (10 violations)
-- Memory   : mem://security/security-definer-acl-policy
-- Created  : 2026-06-18 — auditoria automatizada
--
-- ESTE ARQUIVO NÃO SERÁ EXECUTADO PELO LOVABLE.
-- O tool `supabase--migration` aponta para `pqp` (proibido pela REGRA #1).
-- O alvo é o canônico `doufsxqlfjyuvxuezpln`.
--
-- Aplicar manualmente (PO):
--   psql "$DOUFS_DB_URL" -f qa/migrations-draft/2026-06-18_security_definer_acl.sql
--
-- WHY
-- ----
-- O gate `scripts/check-security-definer-acl.mjs` (RPC
-- `audit_security_definer_acl`) detectou 10 violações nas 4 funções abaixo.
-- check_seller_cart_limit e handle_password_reset_request são TRIGGER FUNCTIONS:
-- nunca devem ser callable diretamente pelo Data API.
-- check_auth_config_status e refresh_product_popularity são operacionais:
-- só devem rodar via service_role (edge/cron).
-- =============================================================================

BEGIN;

-- 1) check_auth_config_status — diagnóstico, não deve ser pública.
REVOKE EXECUTE ON FUNCTION public.check_auth_config_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_auth_config_status() FROM anon;

-- 2) check_seller_cart_limit — TRIGGER FUNCTION, nunca callable diretamente.
REVOKE EXECUTE ON FUNCTION public.check_seller_cart_limit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_seller_cart_limit() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_seller_cart_limit() FROM authenticated;

-- 3) handle_password_reset_request — TRIGGER FUNCTION, nunca callable diretamente.
REVOKE EXECUTE ON FUNCTION public.handle_password_reset_request() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_password_reset_request() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_password_reset_request() FROM authenticated;

-- 4) refresh_product_popularity — operacional/cron, só service_role.
REVOKE EXECUTE ON FUNCTION public.refresh_product_popularity() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_product_popularity() FROM anon;

-- Verificação pós-aplicação (deve retornar 0 linhas para essas funções):
-- SELECT * FROM public.audit_security_definer_acl()
--   WHERE function_name IN (
--     'check_auth_config_status',
--     'check_seller_cart_limit',
--     'handle_password_reset_request',
--     'refresh_product_popularity'
--   );

COMMIT;
