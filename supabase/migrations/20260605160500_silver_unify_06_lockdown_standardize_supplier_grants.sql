-- ════════════════════════════════════════════════════════════════
-- UNIFICAÇÃO MEDALLION — Fase 6 (segurança)
-- Tranca a execução de fn_standardize_supplier (SECURITY DEFINER).
-- ════════════════════════════════════════════════════════════════
-- Advisor: anon_/authenticated_security_definer_function_executable.
-- fn_standardize_supplier é SECURITY DEFINER (bypassa RLS) e nasceu com
-- EXECUTE para PUBLIC. O guard interno usa auth.uid() IS NOT NULL, que NÃO
-- barra o papel `anon` (uid NULL). Replicamos a ACL do motor fn_process_raw_v2:
-- somente postgres + service_role (o cron roda como service_role/postgres).
-- ════════════════════════════════════════════════════════════════

REVOKE ALL ON FUNCTION public.fn_standardize_supplier(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_standardize_supplier(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.fn_standardize_supplier(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_standardize_supplier(uuid, integer) TO postgres;
GRANT EXECUTE ON FUNCTION public.fn_standardize_supplier(uuid, integer) TO service_role;
