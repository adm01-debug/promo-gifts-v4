-- Hardening: revogar EXECUTE de PUBLIC/anon/authenticated em 4 funções SECURITY DEFINER
-- detectadas pelo gate scripts/check-security-definer-acl.mjs.
-- Mantém acesso para service_role (edge functions / admin code) e o owner do banco.

REVOKE EXECUTE ON FUNCTION public.check_auth_config_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_seller_cart_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_password_reset_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_product_popularity() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_auth_config_status() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_product_popularity() TO service_role;
-- check_seller_cart_limit e handle_password_reset_request são funções de TRIGGER:
-- triggers executam com privilégios do owner, não precisam de EXECUTE para nenhum papel runtime.