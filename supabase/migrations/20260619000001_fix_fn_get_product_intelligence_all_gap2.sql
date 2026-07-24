-- GAP-2 FIX (2026-06-19 audit)
-- fn_get_product_intelligence_all: filtrar produtos inativos/deletados.
--
-- Problema: analytics.mv_product_intelligence incluía 72 registros de produtos
-- desativados (originados de analytics.mv_stock_velocity que não filtra por
-- is_active). A função retornava esses 72 inativos para o frontend, que os
-- incluía no supplierSalesMap, potencialmente distorcendo o sort best-seller.
--
-- Fix: JOIN com products para filtrar apenas ativos e não-deletados.
-- Não altera a MV de analytics (que pode ter outros usos).
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_get_product_intelligence_all()
RETURNS TABLE(
  product_id          uuid,
  turnover_score      numeric,
  avg_depletion_7d    numeric,
  avg_depletion_30d   numeric,
  abc_classification  text,
  total_depleted_30d  numeric,
  total_depleted_90d  numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  -- FIX GAP-2 (2026-06-19 audit): filtra produtos inativos/deletados.
  -- analytics.mv_product_intelligence incluía 72 registros de produtos desativados
  -- (originados de analytics.mv_stock_velocity que não filtra por is_active).
  -- JOIN com products garante que a API sempre retorna apenas produtos ativos.
  SELECT
    mi.product_id,
    mi.turnover_score,
    mi.avg_depletion_7d,
    mi.avg_depletion_30d,
    mi.abc_classification,
    mi.total_depleted_30d,
    mi.total_depleted_90d
  FROM mv_product_intelligence mi          -- public view → analytics.mv_product_intelligence
  JOIN products p ON p.id = mi.product_id  -- filter: apenas ativos e não deletados
  WHERE p.is_active = true
    AND (p.is_deleted IS NOT TRUE OR p.is_deleted IS NULL);
$function$;

COMMENT ON FUNCTION public.fn_get_product_intelligence_all() IS
  'Retorna TODAS as linhas de mv_product_intelligence para produtos ATIVOS sem limitação de max_rows.
   FIX BUG-A (2026-06-18): bypassa PostgREST max_rows=1000.
   FIX GAP-2 (2026-06-19 audit): filtra inativos/deletados via JOIN com products.
   Consumida por useSupplierSalesRanking para popular supplierSalesMap.';

-- UNIQUE INDEX em analytics.mv_product_intelligence para REFRESH CONCURRENTLY
-- (o índice normal existente não permite CONCURRENTLY)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_product_intelligence_product_id_unique
  ON analytics.mv_product_intelligence (product_id);

-- Refresh com CONCURRENTLY para remover os 72 inativos sem bloquear leituras
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_product_intelligence;

NOTIFY pgrst, 'reload schema';
