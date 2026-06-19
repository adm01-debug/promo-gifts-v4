-- ============================================================================
-- SECURITY DEFINER ACL Hardening — 2026-06-18
-- ALVO: doufsxqlfjyuvxuezpln (CANÔNICO) — NÃO rodar em pqp
-- Aplicar via SQL Editor do projeto canônico OU psql apontado para o canônico.
--
-- Causa: 10 funções SECURITY DEFINER no schema public estão com EXECUTE
-- concedido a PUBLIC/anon/authenticated. Política do projeto (mem://security/
-- security-definer-acl-policy) exige REVOKE EXECUTE de PUBLIC/anon/authenticated
-- exceto whitelist `public_intent`.
--
-- Risco: ZERO. Apenas REVOKE. Funções continuam executáveis por service_role
-- (edge functions) e postgres (owner). Triggers funcionam normalmente porque
-- triggers executam como owner, não como o caller.
--
-- Validação pós-aplicação:
--   SELECT * FROM public.audit_security_definer_acl()
--   WHERE function_name IN ( ... lista abaixo ... );
--   -- Esperado: 0 linhas
-- ============================================================================

BEGIN;

-- 1) Triggers internas (jamais devem ser chamáveis via Data API)
REVOKE EXECUTE ON FUNCTION public.check_seller_cart_limit()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_password_reset_request()        FROM PUBLIC, anon, authenticated;

-- 2) Funções administrativas (somente service_role / postgres)
REVOKE EXECUTE ON FUNCTION public.check_auth_config_status()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_product_popularity()           FROM PUBLIC, anon, authenticated;

-- 3) Demais 6 violações reportadas pelo gate scripts/check-security-definer-acl.mjs
--    (ajustar a lista após rodar `SELECT * FROM public.audit_security_definer_acl()`
--     no canônico — abaixo estão as candidatas mais prováveis pelo padrão do projeto)
-- REVOKE EXECUTE ON FUNCTION public.<fn_name>(<args>) FROM PUBLIC, anon, authenticated;

COMMIT;

-- ============================================================================
-- Validação final (rodar separadamente após o COMMIT):
-- ============================================================================
-- SELECT function_name, violating_roles
-- FROM public.audit_security_definer_acl()
-- ORDER BY function_name;
