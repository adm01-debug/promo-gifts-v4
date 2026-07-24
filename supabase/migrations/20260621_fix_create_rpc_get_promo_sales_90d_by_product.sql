-- APLICADO: 2026-06-21
-- Fix: cria função get_promo_sales_90d_by_product
-- Resolve: HTTP 404 em /rest/v1/rpc/get_promo_sales_90d_by_product

CREATE OR REPLACE FUNCTION public.get_promo_sales_90d_by_product()
RETURNS TABLE (
  product_id     uuid,
  total_quantity bigint,
  total_revenue  numeric,
  order_count    bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    oi.product_id,
    SUM(oi.quantity)::bigint          AS total_quantity,
    SUM(oi.subtotal)::numeric         AS total_revenue,
    COUNT(DISTINCT oi.order_id)::bigint AS order_count
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE
    o.created_at >= (NOW() - INTERVAL '90 days')
    AND o.status NOT IN ('cancelled', 'refunded', 'cancelado', 'estornado')
    AND oi.product_id IS NOT NULL
  GROUP BY oi.product_id
  HAVING SUM(oi.quantity) > 0;
$$;

GRANT EXECUTE ON FUNCTION public.get_promo_sales_90d_by_product()
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_promo_sales_90d_by_product() IS
  'Retorna total de unidades vendidas, receita e número de pedidos dos últimos 90 dias, agrupados por product_id. Pedidos cancelados/estornados são excluídos.';

NOTIFY pgrst, 'reload schema';
