-- ============================================================================
-- MIGRATION ADITIVA — NÃO ALTERA fn_get_reposicao_listing
-- Aplicar em: doufsxqlfjyuvxuezpln (banco Gold canônico)
-- Onde:       Supabase Dashboard → SQL Editor → New query → colar → Run
-- ============================================================================
-- Cria RPC `fn_get_reposicao_variants_summary(p_product_ids uuid[])` retornando,
-- por produto, agregação JSONB de variantes (cor) + KPIs auxiliares.
--
-- Schema confirmado (2026-06-19):
--   product_variants:         id, product_id, color_name, color_hex,
--                             stock_quantity, next_date_1..6, is_active
--   variant_supplier_sources: variant_id, next_date_1..6, is_active
--
-- Regra de negócio:
--   • stock_qty           = product_variants.stock_quantity (já agregado)
--   • next_restock_date   = menor data ESTRITAMENTE > hoje (BR) entre next_date_1..6
--                           de product_variants OU variant_supplier_sources ativos
--   • has_upcoming_restock= (next_restock_date IS NOT NULL)
--   • Boundary STRICT (> hoje): data do dia corrente não é "upcoming" — mercadoria
--     prevista para hoje deve ter chegado; consistente com fn_get_reposicao_listing.
--   • Timezone: America/Sao_Paulo (UTC-3, sem DST desde 2019), igual à listing.
--
-- Changelog:
--   v1 2026-06-19: criação inicial (Lovable draft)
--   v2 2026-06-19: M1 — CURRENT_DATE → timezone Brazil correto
--   v3 2026-06-19: M2 — >= hoje → > hoje (boundary strict, alinhado à listing)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_get_reposicao_variants_summary(
  p_product_ids uuid[]
)
RETURNS TABLE (
  product_id              uuid,
  variants_summary        jsonb,
  total_variants          int,
  variants_in_stock       int,
  variants_zeroed         int,
  variants_with_upcoming  int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH v_today AS (
    -- Timezone Brasil (UTC-3, sem DST desde 2019) — mesmo padrão de fn_get_reposicao_listing
    SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS d
  ),
  future_dates AS (
    -- Datas ESTRITAMENTE futuras (> hoje BR) de product_variants
    SELECT pv.id AS variant_id, x.d::date AS dt
    FROM public.product_variants pv
    CROSS JOIN LATERAL (VALUES
      (pv.next_date_1),(pv.next_date_2),(pv.next_date_3),
      (pv.next_date_4),(pv.next_date_5),(pv.next_date_6)
    ) AS x(d)
    WHERE pv.product_id = ANY(p_product_ids)
      AND x.d IS NOT NULL
      AND x.d::date > (SELECT v_today.d FROM v_today)
    UNION ALL
    -- Datas ESTRITAMENTE futuras de variant_supplier_sources ativos
    -- (defensivo: cobre casos onde PV.next_date_* ainda não foi propagado do VSS)
    SELECT vss.variant_id, x.d::date
    FROM public.variant_supplier_sources vss
    JOIN public.product_variants pv2 ON pv2.id = vss.variant_id
    CROSS JOIN LATERAL (VALUES
      (vss.next_date_1),(vss.next_date_2),(vss.next_date_3),
      (vss.next_date_4),(vss.next_date_5),(vss.next_date_6)
    ) AS x(d)
    WHERE pv2.product_id = ANY(p_product_ids)
      AND COALESCE(vss.is_active, true) = true
      AND x.d IS NOT NULL
      AND x.d::date > (SELECT v_today.d FROM v_today)
  ),
  next_per_variant AS (
    -- MIN garante que múltiplos VSS por variante não inflem contagens
    SELECT variant_id, MIN(dt) AS next_restock_date
    FROM future_dates
    GROUP BY variant_id
  ),
  vs AS (
    SELECT
      pv.product_id,
      pv.id                                   AS variant_id,
      pv.color_name                           AS nome,
      pv.color_hex                            AS hex,
      COALESCE(pv.stock_quantity, 0)::int     AS stock_qty,
      npv.next_restock_date
    FROM public.product_variants pv
    LEFT JOIN next_per_variant npv ON npv.variant_id = pv.id
    WHERE pv.product_id = ANY(p_product_ids)
      AND COALESCE(pv.is_active, true) = true
  )
  SELECT
    vs.product_id,
    jsonb_agg(
      jsonb_build_object(
        'variant_id',           vs.variant_id,
        'nome',                 vs.nome,
        'hex',                  vs.hex,
        'stock_qty',            vs.stock_qty,
        'has_upcoming_restock', (vs.next_restock_date IS NOT NULL),
        'next_restock_date',    vs.next_restock_date
      )
      ORDER BY vs.nome NULLS LAST
    )                                                              AS variants_summary,
    COUNT(*)::int                                                  AS total_variants,
    COUNT(*) FILTER (WHERE vs.stock_qty > 0)::int                  AS variants_in_stock,
    COUNT(*) FILTER (WHERE vs.stock_qty = 0
                     AND vs.next_restock_date IS NULL)::int        AS variants_zeroed,
    COUNT(*) FILTER (WHERE vs.next_restock_date IS NOT NULL)::int  AS variants_with_upcoming
  FROM vs
  GROUP BY vs.product_id;
$$;

REVOKE ALL ON FUNCTION public.fn_get_reposicao_variants_summary(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_reposicao_variants_summary(uuid[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_get_reposicao_variants_summary(uuid[]) IS
  'Reposição UI helper — variantes (cor) por produto com stock_qty e next_restock_date (pv+vss). Timezone: America/Sao_Paulo. Boundary: > hoje (strict, igual a fn_get_reposicao_listing). v3 2026-06-19.';

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- VALIDAÇÃO (rode após o CREATE):
--
--   -- Teste básico:
--   SELECT * FROM public.fn_get_reposicao_variants_summary(
--     ARRAY(SELECT id FROM public.products LIMIT 3)::uuid[]
--   );
--
--   -- Verifica que a função usa TZ BR e boundary strict:
--   SELECT
--     position('CURRENT_DATE'        IN pg_get_functiondef(oid)) = 0 AS sem_current_date,
--     position('America/Sao_Paulo'   IN pg_get_functiondef(oid)) > 0 AS tem_tz_br,
--     position('> (SELECT v_today'   IN pg_get_functiondef(oid)) > 0 AS boundary_strict_ok
--   FROM pg_proc
--   WHERE proname = 'fn_get_reposicao_variants_summary'
--     AND pronamespace = 'public'::regnamespace;
-- ============================================================================
