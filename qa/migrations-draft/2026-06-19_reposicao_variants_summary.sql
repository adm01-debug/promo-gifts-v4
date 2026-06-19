-- ============================================================================
-- MIGRATION ADITIVA — NÃO ALTERA fn_get_reposicao_listing
-- Aplicar em: doufsxqlfjyuvxuezpln (banco Gold canônico)
-- Onde:       Supabase Dashboard → SQL Editor → New query → colar → Run
-- ============================================================================
--
-- Cria a RPC `fn_get_reposicao_variants_summary(p_product_ids uuid[])` que
-- retorna, por produto, o array JSONB de variantes (cor) com:
--   { nome, hex, stock_qty, has_upcoming_restock, next_restock_date }
--
-- Usada pelo módulo Reposição (cliente) para:
--   • Overlay no swatch quando stock=0 e sem reposição prevista
--   • Tooltip "qtd por cor"
--   • Indicador "X/Y cores em estoque"
--   • Badges "Reposto: <cor>" / "Esgotado: <cor>" no card
--
-- IMPORTANTE: ajuste os nomes de colunas (>>>AJUSTE<<<) caso seu schema
-- difira. Os mais prováveis estão como default; rode o SELECT de inspeção
-- abaixo antes do CREATE FUNCTION se quiser conferir.
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public'
--     AND table_name IN ('product_variants','variant_supplier_sources')
--   ORDER BY table_name, ordinal_position;
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_get_reposicao_variants_summary(
  p_product_ids uuid[]
)
RETURNS TABLE (
  product_id        uuid,
  variants_summary  jsonb,
  total_variants    int,
  variants_in_stock int,
  variants_zeroed   int,
  variants_with_upcoming int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH vs AS (
    SELECT
      pv.product_id,
      -- >>>AJUSTE<<< nomes prováveis: color_name | nome_cor | name
      COALESCE(pv.color_name, pv.name)                                AS nome,
      -- >>>AJUSTE<<< hex prováveis: color_hex | hex | cor_hex
      COALESCE(pv.color_hex, pv.hex)                                  AS hex,
      -- >>>AJUSTE<<< estoque agregado da variante (em todos os fornecedores)
      COALESCE(SUM(vss.stock_quantity), 0)::int                       AS stock_qty,
      -- >>>AJUSTE<<< menor data futura de reposição entre fornecedores
      MIN(vss.next_date_1) FILTER (
        WHERE vss.next_date_1::date >= CURRENT_DATE
      )                                                               AS next_restock_date
    FROM public.product_variants pv
    LEFT JOIN public.variant_supplier_sources vss
      ON vss.variant_id = pv.id
    WHERE pv.product_id = ANY(p_product_ids)
    GROUP BY pv.id, pv.product_id, pv.color_name, pv.name, pv.color_hex, pv.hex
  )
  SELECT
    vs.product_id,
    jsonb_agg(
      jsonb_build_object(
        'nome',                 vs.nome,
        'hex',                  vs.hex,
        'stock_qty',            vs.stock_qty,
        'has_upcoming_restock', (vs.next_restock_date IS NOT NULL),
        'next_restock_date',    vs.next_restock_date
      )
      ORDER BY vs.nome NULLS LAST
    )                                                            AS variants_summary,
    COUNT(*)::int                                                AS total_variants,
    COUNT(*) FILTER (WHERE vs.stock_qty > 0)::int                AS variants_in_stock,
    COUNT(*) FILTER (WHERE vs.stock_qty = 0
                     AND vs.next_restock_date IS NULL)::int      AS variants_zeroed,
    COUNT(*) FILTER (WHERE vs.next_restock_date IS NOT NULL)::int AS variants_with_upcoming
  FROM vs
  GROUP BY vs.product_id;
$$;

REVOKE ALL ON FUNCTION public.fn_get_reposicao_variants_summary(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_reposicao_variants_summary(uuid[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_get_reposicao_variants_summary(uuid[]) IS
  'Reposição UI helper — retorna variantes (cor) por produto com stock_qty e next_restock_date. Aditivo, não substitui fn_get_reposicao_listing.';
