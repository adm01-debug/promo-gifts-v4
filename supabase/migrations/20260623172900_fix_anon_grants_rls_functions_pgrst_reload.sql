-- ============================================================
-- APLICADO: 2026-06-23 17:29 UTC
-- Sessão: Fix bugs console HEAD 403/500 (useCloudStatus)
-- ============================================================
-- CONTEXTO:
-- O hook useCloudStatus dispara queries HEAD/COUNT imediatamente
-- no mount, antes do JWT de autenticação estar pronto.
-- As requisições saem como role=anon e falham com:
--   - HTTP 403: tabelas sem GRANT SELECT para anon
--   - HTTP 500: funções RLS sem GRANT EXECUTE para anon
--   - HTTP 400: schema cache PostgREST obsoleto
--
-- ROOT CAUSE #1: discount_approval_requests e workspace_notifications
--   sem GRANT SELECT TO anon → HTTP 403
-- ROOT CAUSE #2: user_is_org_member, is_coord_or_above etc.
--   sem GRANT EXECUTE TO anon → HTTP 500 em policies FOR PUBLIC
-- ROOT CAUSE #3: v_products_public modificada pelo Lovable bot
--   sem NOTIFY pgrst → schema cache obsoleto → HTTP 400
-- ============================================================

-- FIX 1: GRANT SELECT para anon
-- anon + RLS PERMISSIVE sem policy matching = 0 linhas (seguro)
GRANT SELECT ON public.discount_approval_requests TO anon;
GRANT SELECT ON public.workspace_notifications TO anon;

-- FIX 2: GRANT EXECUTE nas funções SECURITY DEFINER usadas
-- em RLS policies FOR PUBLIC (chamadas pelo anon ao fazer COUNT)
-- SEGURO: SECURITY DEFINER roda como postgres
--         auth.uid() = null para anon → todas retornam false
GRANT EXECUTE ON FUNCTION public.user_is_org_member(uuid)    TO anon;
GRANT EXECUTE ON FUNCTION public.is_coord_or_above(uuid)     TO anon;
GRANT EXECUTE ON FUNCTION public.is_org_owner_or_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid)   TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_above(uuid)     TO anon;

-- FIX 3: Reload schema cache PostgREST
-- Necessário após Lovable bot modificar view v_products_public
NOTIFY pgrst, 'reload schema';
