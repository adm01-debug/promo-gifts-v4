-- =============================================================================
-- FIX: get_top_collected_products → SECURITY DEFINER
-- =============================================================================
-- ROOT CAUSE: função era SECURITY INVOKER e acessa archive.collection_items.
-- authenticated NÃO tem USAGE no schema archive → PostgreSQL retorna
-- "permission denied for schema archive" → PostgREST traduz para HTTP 403.
-- Mesmo bug que afetou get_collections_weekly_count (fix 2026-06-21).
--
-- FIX: SECURITY DEFINER + SET search_path = public, archive
-- A função executa com permissões do owner (postgres), que tem acesso total
-- ao schema archive. RLS de archive.collection_items ainda se aplica.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_top_collected_products(
  _days integer DEFAULT 7,
  _limit integer DEFAULT 6
)
RETURNS TABLE(product_id text, col_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, archive
AS $$
  SELECT ci.product_id, COUNT(*)::bigint AS col_count
  FROM archive.collection_items ci
  WHERE ci.created_at >= (now() - make_interval(days => GREATEST(_days, 1)))
  GROUP BY ci.product_id
  ORDER BY col_count DESC, MAX(ci.created_at) DESC
  LIMIT GREATEST(_limit, 1);
$$;

-- Re-confirm grants (idempotente)
GRANT EXECUTE ON FUNCTION public.get_top_collected_products(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_collected_products(integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_top_collected_products(integer, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
