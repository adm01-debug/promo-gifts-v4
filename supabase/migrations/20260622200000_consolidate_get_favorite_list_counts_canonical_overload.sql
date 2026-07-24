-- ============================================================================
-- Migration: consolida get_favorite_list_counts em UM overload canônico
-- Data: 2026-06-22
-- ----------------------------------------------------------------------------
-- ROOT CAUSE (HTTP 404 em /rest/v1/rpc/get_favorite_list_counts):
--   Migrations conflitantes alternaram a assinatura entre:
--     - get_favorite_list_counts()            [sem argumento]
--     - get_favorite_list_counts(_user_id uuid) [com argumento]
--   e o CI aplicava arquivos antigos em tempo real. No momento da falha só a
--   versão SEM argumento existia, mas o frontend (useFavoriteLists.ts) chama:
--     untypedRpc('get_favorite_list_counts', { _user_id: user.id })
--   ou seja, COM argumento. O PostgREST procura get_favorite_list_counts(uuid),
--   não acha, e devolve 404.
--   NÃO era cache stale (pgrst_ddl_watch já dá NOTIFY reload em todo DDL) nem
--   falta de grant pra anon (isso seria 403, não 404).
--
-- FIX: uma única função canônica com parâmetro OPCIONAL (DEFAULT NULL), que
--   casa as duas convenções de chamada ({_user_id} e {}) sem ambiguidade de
--   overload. Filtro real sempre via COALESCE(_user_id, auth.uid()) com gate
--   de segurança (próprio usuário OU admin) — sem IDOR. EXECUTE só pra
--   authenticated (anon é removido pelo event trigger de ACL; função é
--   user-scoped, comportamento desejado).
-- ============================================================================

-- Remove AMBAS as assinaturas (idempotente) para encerrar a duplicação.
DROP FUNCTION IF EXISTS public.get_favorite_list_counts();
DROP FUNCTION IF EXISTS public.get_favorite_list_counts(uuid);

CREATE FUNCTION public.get_favorite_list_counts(_user_id uuid DEFAULT NULL)
  RETURNS TABLE(list_id uuid, item_count bigint)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $fn$
  SELECT
    fl.id                AS list_id,
    COUNT(fi.id)::bigint AS item_count
  FROM favorite_lists fl
  LEFT JOIN favorite_items fi ON fi.list_id = fl.id
  WHERE fl.user_id = COALESCE(_user_id, (SELECT auth.uid()))
    AND (
         COALESCE(_user_id, (SELECT auth.uid())) = (SELECT auth.uid())
      OR is_admin_or_above((SELECT auth.uid()))
    )
    AND fl.is_archived = false
  GROUP BY fl.id
  ORDER BY fl.position ASC NULLS LAST, fl.created_at ASC;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_favorite_list_counts(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_favorite_list_counts(uuid) IS
'Contagem de itens por lista de favoritos do chamador. Param _user_id é opcional (DEFAULT NULL) para casar tanto a chamada {_user_id} do frontend quanto chamadas sem args. Filtro real sempre via COALESCE(_user_id, auth.uid()) com gate (proprio usuario OU admin) — sem IDOR. Assinatura unica canonica: encerra a guerra de overloads ()/(uuid). Codificado em 2026-06-22.';

-- Recarrega o schema cache do PostgREST (redundante: pgrst_ddl_watch já dispara).
NOTIFY pgrst, 'reload schema';
