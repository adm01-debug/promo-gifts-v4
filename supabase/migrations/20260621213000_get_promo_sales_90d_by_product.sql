-- BUG-PROMO-90D-01 FIX (2026-06-21 catalog audit)
-- get_promo_sales_90d_by_product: RPC para contagem de vendas reais (90 dias).
--
-- PROBLEMA: usePromoSales90dByProduct.ts fazia SELECT completo de order_items
-- client-side (.select('product_id, quantity, created_at').gte('created_at', ...))
-- transmitindo potencialmente dezenas de milhares de linhas ao browser para agregar em JS.
-- Mesmo padrão corrigido em get_promo_sales_ranking (quote_items) em 2026-06-18.
--
-- SOLUÇÃO: SUM(quantity) GROUP BY product_id server-side — retorna apenas
-- {product_id, total_qty} com N linhas (N = produtos distintos vendidos).
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_promo_sales_90d_by_product()
RETURNS TABLE(product_id uuid, total_qty bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT
    oi.product_id,
    COALESCE(SUM(oi.quantity), 0)::bigint AS total_qty
  FROM order_items oi
  WHERE oi.product_id IS NOT NULL
    AND oi.quantity > 0
    AND oi.created_at >= NOW() - INTERVAL '90 days'
  GROUP BY oi.product_id
  ORDER BY total_qty DESC;
$function$;

COMMENT ON FUNCTION public.get_promo_sales_90d_by_product() IS
  'Quantidade vendida por produto nos últimos 90 dias (order_items).
   BUG-PROMO-90D-01 — 2026-06-21. Substitui client-side table scan.';

GRANT EXECUTE ON FUNCTION public.get_promo_sales_90d_by_product()
  TO anon, authenticated;
