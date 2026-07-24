-- ============================================================
-- get_favorite_list_counts(_user_id uuid) — overload com parâmetro
-- Data: 2026-06-22
--
-- CONTEXTO:
--   O hook useFavoriteLists.ts chama:
--     untypedRpc('get_favorite_list_counts', { _user_id: user.id })
--   PostgREST faz match por assinatura: busca get_favorite_list_counts(_user_id uuid).
--   A versão () (sem args) existe, mas gera 404 para calls com body {_user_id: "..."}.
--
-- SOLUÇÃO:
--   Criar overload com _user_id uuid.
--   - Mantém a versão () intacta (outros callers podem usá-la via auth.uid() interno).
--   - Novo overload é SECURITY DEFINER com guard explícito:
--       _user_id = auth.uid()            → acessa só as próprias listas
--       OR is_admin_or_above(auth.uid()) → admin vê qualquer lista
--   - Retorna TABLE(list_id uuid, item_count bigint) — mesmo contrato.
--   - anon revogado: retorno vazio garantido pelo guard, mas melhor ser explícito.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_favorite_list_counts(_user_id uuid)
RETURNS TABLE(list_id uuid, item_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    fl.id                    AS list_id,
    COUNT(fi.id)::bigint     AS item_count
  FROM favorite_lists fl
  LEFT JOIN favorite_items fi ON fi.list_id = fl.id
  WHERE fl.user_id = _user_id
    AND (
         _user_id = (SELECT auth.uid())
      OR is_admin_or_above((SELECT auth.uid()))
    )
    AND fl.is_archived = false
  GROUP BY fl.id
  ORDER BY fl.position ASC NULLS LAST, fl.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_favorite_list_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_favorite_list_counts(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_favorite_list_counts(uuid) FROM anon;
