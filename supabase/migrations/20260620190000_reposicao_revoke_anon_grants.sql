-- ============================================================================
-- Reposição — fecha brecha de exposição a `anon` (regressão de BUG-SEC-1)
--
-- CONTEXTO
--   A migração `fix_reposicao_rpcs` (2026-06-19) já havia revogado EXECUTE de
--   `anon` em fn_get_reposicao_listing e fn_get_replenishment_stats. Porém o
--   estado VIVO do banco voltou a conceder acesso a `anon`: a recriação
--   posterior das funções reaplicou o GRANT padrão do Supabase
--   (ALTER DEFAULT PRIVILEGES … TO anon) e o REVOKE não foi re-executado.
--
--   O Security Advisor do Supabase (lint `anon_security_definer_function_executable`)
--   e a auditoria do módulo confirmaram que ambas as RPCs SECURITY DEFINER
--   estavam chamáveis por usuários ANÔNIMOS via /rest/v1/rpc/<fn>, vazando
--   catálogo, preço de venda e fornecedor sem autenticação.
--
--   A view `vw_product_availability` estava com SELECT liberado para `anon`
--   (RLS não se aplica a views; a view roda como owner — SECURITY DEFINER —
--   e contorna a RLS de product_variants), expondo estoque e datas de
--   reposição por variante.
--
-- SEGURANÇA DA MUDANÇA
--   A rota /reposicao é montada sob ProtectedRoute (somente autenticados) e o
--   restante do módulo (sino "Chegou" → fn_get_recent_restocks) já opera apenas
--   com `authenticated`. Logo, remover `anon`/`PUBLIC` não quebra nenhum fluxo.
--
--   REVOKE/GRANT são idempotentes — reaplicar esta migração é seguro.
-- ============================================================================

-- ─── 1. fn_get_reposicao_listing ───────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.fn_get_reposicao_listing(uuid, uuid, text, integer, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_get_reposicao_listing(uuid, uuid, text, integer, integer, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_get_reposicao_listing(uuid, uuid, text, integer, integer, integer) TO authenticated;

-- ─── 2. fn_get_replenishment_stats ─────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.fn_get_replenishment_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_get_replenishment_stats() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_get_replenishment_stats() TO authenticated;

-- ─── 3. vw_product_availability (view SECURITY DEFINER) ─────────────────────
REVOKE SELECT ON public.vw_product_availability FROM anon;
REVOKE SELECT ON public.vw_product_availability FROM PUBLIC;
GRANT  SELECT ON public.vw_product_availability TO authenticated;

-- Recarrega o cache de schema do PostgREST para refletir os grants imediatamente
NOTIFY pgrst, 'reload schema';
