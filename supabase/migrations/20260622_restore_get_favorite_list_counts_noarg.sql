-- ============================================================
-- get_favorite_list_counts() — restauração do overload sem args
-- Data: 2026-06-22
--
-- CONTEXTO: Durante a bateria de validação pós-correção, detectou-se
-- que a overload () (sem parâmetros) havia desaparecido do banco.
-- Causa provável: alguma migration anterior (drop_dead_cols_step3 ou
-- equivalente) que usou CASCADE em objetos dependentes pode ter criado
-- um efeito colateral. O overload (_user_id uuid) estava correto.
-- Esta migration restaura a versão sem args com body e grants originais.
--
-- Body original reconstruído da captura feita no início da sessão.
-- Grants originais: postgres/authenticated/service_role/anon = EXECUTE
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_favorite_list_counts()
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
  WHERE fl.user_id = (SELECT auth.uid())
    AND fl.is_archived = false
  GROUP BY fl.id
  ORDER BY fl.position ASC NULLS LAST, fl.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_favorite_list_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_favorite_list_counts() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_favorite_list_counts() TO anon;
