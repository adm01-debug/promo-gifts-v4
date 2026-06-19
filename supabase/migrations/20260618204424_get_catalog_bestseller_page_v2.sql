-- DRIFT MIGRATION (2026-06-19 audit GAP-4)
-- Função criada diretamente no banco em 2026-06-18 sem arquivo correspondente.
-- Este arquivo codifica o estado atual para rastreamento e reprodutibilidade.
--
-- get_catalog_bestseller_page v2:
--   • Remove hard cap de 2000 (v1 usava LEAST(..., 2000))
--   • best-seller-supplier: ORDER BY turnover_score DESC (mv_product_intelligence)
--   • best-seller-promo: ORDER BY sum(quote_items.quantity) DESC (vendas reais)
--   • Fallback graceful: name ASC para p_sort inválido
--   • GREATEST(p_limit, 0) previne LIMIT negativo
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_catalog_bestseller_page(
  p_sort   text    DEFAULT 'best-seller-supplier',
  p_limit  integer DEFAULT 500,
  p_offset integer DEFAULT 0
)
RETURNS SETOF public.v_products_public
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  -- Remove hard cap de 2000; aceita qualquer limit >= 0; default 500.
  v_limit  integer := GREATEST(COALESCE(p_limit, 500), 0);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_sql    text;
BEGIN
  IF p_sort = 'best-seller-supplier' THEN
    v_sql := '
      SELECT vp.*
      FROM public.v_products_public vp
      LEFT JOIN public.mv_product_intelligence mi ON mi.product_id = vp.id
      WHERE vp.active = true
      ORDER BY COALESCE(mi.turnover_score, 0) DESC NULLS LAST, vp.name ASC, vp.id ASC
      LIMIT ' || v_limit || ' OFFSET ' || v_offset;

  ELSIF p_sort = 'best-seller-promo' THEN
    -- Sort por quote_items (vendas reais em orçamentos aprovados/pendentes/enviados)
    v_sql := '
      SELECT vp.*
      FROM public.v_products_public vp
      LEFT JOIN (
        SELECT product_id AS pid, sum(COALESCE(quantity, 1)) AS promo_qty
        FROM public.quote_items
        WHERE product_id IS NOT NULL
        GROUP BY product_id
      ) qs ON qs.pid = vp.id
      WHERE vp.active = true
      ORDER BY
        COALESCE(qs.promo_qty, 0) DESC NULLS LAST,
        COALESCE(vp.is_bestseller, false) DESC,
        vp.name ASC, vp.id ASC
      LIMIT ' || v_limit || ' OFFSET ' || v_offset;

  ELSE
    -- Fallback graceful: name ASC para p_sort inválido ou NULL
    v_sql := '
      SELECT vp.*
      FROM public.v_products_public vp
      WHERE vp.active = true
      ORDER BY vp.name ASC, vp.id ASC
      LIMIT ' || v_limit || ' OFFSET ' || v_offset;
  END IF;

  RETURN QUERY EXECUTE v_sql;
END;
$function$;

COMMENT ON FUNCTION public.get_catalog_bestseller_page(text,integer,integer) IS
  'Sort server-side de v_products_public para best-seller-supplier (turnover_score) e
   best-seller-promo (quote_items). v2 2026-06-18: sem hard cap de 2000.
   Tie-break name ASC, id ASC. STABLE, SECURITY DEFINER, search_path=public.';

GRANT EXECUTE ON FUNCTION public.get_catalog_bestseller_page(text,integer,integer)
  TO anon, authenticated;
