-- DRIFT MIGRATION (2026-06-19 audit GAP-4)
-- get_promo_sales_ranking: nova função para ranking de vendas em orçamentos.
-- Criada diretamente no banco em 2026-06-18 sem arquivo correspondente.
-- Usada pelo sort best-seller-promo como alternativa mais precisa ao is_bestseller.
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_promo_sales_ranking()
RETURNS TABLE(product_id uuid, total_qty bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT
    qi.product_id,
    COALESCE(SUM(qi.quantity), 0)::bigint AS total_qty
  FROM quote_items qi
  JOIN quotes q ON q.id = qi.quote_id
  WHERE qi.product_id IS NOT NULL
    AND q.status IN ('approved', 'pending', 'sent', 'viewed', 'accepted')
  GROUP BY qi.product_id
  ORDER BY total_qty DESC;
$function$;

COMMENT ON FUNCTION public.get_promo_sales_ranking() IS
  'Ranking de produtos por volume em orçamentos não-rascunho.
   Audit-10-10 2026-06-18. Drift codificado em 2026-06-19.';

GRANT EXECUTE ON FUNCTION public.get_promo_sales_ranking()
  TO anon, authenticated;
