-- ============================================================================
-- FIX (gap M4 descoberto em teste adversarial)
-- ----------------------------------------------------------------------------
-- REVOKE ... FROM anon,authenticated não bastou porque toda FUNCTION recebe EXECUTE
-- para PUBLIC por padrão. fn_resync_product_media é SECURITY DEFINER e escreve em
-- products (com argumento NULL recomputa a tabela inteira), então permanecia
-- acessível a anon/authenticated via PUBLIC -> risco de escrita/DoS.
-- Correção: revogar de PUBLIC (e explicitamente de anon/authenticated) e conceder
-- somente a service_role. Verificado: anon=false, authenticated=false, service_role=true.
-- ============================================================================

REVOKE ALL ON FUNCTION public.fn_resync_product_media(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_resync_product_media(uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.fn_resync_product_media(uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_resync_product_media(uuid[]) TO service_role;
