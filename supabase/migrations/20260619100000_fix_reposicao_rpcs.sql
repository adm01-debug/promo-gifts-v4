-- ============================================================
-- Migration: fix_reposicao_rpcs
-- Date: 2026-06-19
-- Bugs fixed:
--   BUG-SEC-1  · fn_get_reposicao_listing, fn_get_replenishment_stats,
--               fn_get_reposicao_metrics exposed to PUBLIC — SECURITY DEFINER
--               callable by anonymous users (product data leak)
--   BUG-DB-1   · fn_get_reposicao_listing, fn_get_replenishment_stats,
--               fn_get_reposicao_metrics, vw_product_availability all existed
--               only in the live DB with no migration file (not reproducible)
--   BUG-DB-2   · variant_agg CTE in fn_get_reposicao_listing only checked
--               next_date_1 for upcoming restock; slots 2-6 were silently
--               ignored — products with restocks only in slots 2-6 showed
--               has_upcoming_restock = false and earliest_restock_qty = 0
--   BUG-DB-3   · category_agg CTE only resolved level-1/2 ancestor categories;
--               products assigned only to level-3+ leaf categories resolved to
--               NULL primary_category_name and were excluded from category filter
--   BUG-FE-2/3 · fn_get_replenishment_stats was missing restockedLast30Days
--               and expiringSoon counts; totalReplenishments was wrongly
--               mapped from restockedThisWeek (7d) instead of the 30d total
--   BUG-VIEW-1 · vw_product_availability has_incoming_stock and
--               has_upcoming_restock only checked next_date_1; slots 2-6 missed
-- ============================================================

-- ─── 0. VIEW: vw_product_availability ───────────────────────────
-- Codify (was missing from migrations) + fix has_incoming_stock /
-- has_upcoming_restock to check all 6 next_date slots.
CREATE OR REPLACE VIEW public.vw_product_availability AS
SELECT
  pv.id AS variant_id,
  pv.product_id,
  pv.sku,
  pv.stock_quantity,
  pv.next_quantity_1, pv.next_date_1,
  pv.next_quantity_2, pv.next_date_2,
  pv.next_quantity_3, pv.next_date_3,
  CASE
    WHEN pv.stock_quantity > 0 THEN 'in_stock'::text
    WHEN pv.stock_quantity = 0 AND (
         (pv.next_date_1 IS NOT NULL AND pv.next_date_1 > CURRENT_DATE) OR
         (pv.next_date_2 IS NOT NULL AND pv.next_date_2 > CURRENT_DATE) OR
         (pv.next_date_3 IS NOT NULL AND pv.next_date_3 > CURRENT_DATE) OR
         (pv.next_date_4 IS NOT NULL AND pv.next_date_4 > CURRENT_DATE) OR
         (pv.next_date_5 IS NOT NULL AND pv.next_date_5 > CURRENT_DATE) OR
         (pv.next_date_6 IS NOT NULL AND pv.next_date_6 > CURRENT_DATE)
    ) THEN 'out_of_stock_with_restock'::text
    ELSE 'out_of_stock'::text
  END AS availability_status,
  -- BUG-VIEW-1 fix: check all 6 slots
  (pv.stock_quantity = 0 AND (
    (pv.next_date_1 IS NOT NULL AND pv.next_date_1 > CURRENT_DATE) OR
    (pv.next_date_2 IS NOT NULL AND pv.next_date_2 > CURRENT_DATE) OR
    (pv.next_date_3 IS NOT NULL AND pv.next_date_3 > CURRENT_DATE) OR
    (pv.next_date_4 IS NOT NULL AND pv.next_date_4 > CURRENT_DATE) OR
    (pv.next_date_5 IS NOT NULL AND pv.next_date_5 > CURRENT_DATE) OR
    (pv.next_date_6 IS NOT NULL AND pv.next_date_6 > CURRENT_DATE)
  )) AS has_incoming_stock,
  (
    (pv.next_date_1 IS NOT NULL AND pv.next_date_1 > CURRENT_DATE) OR
    (pv.next_date_2 IS NOT NULL AND pv.next_date_2 > CURRENT_DATE) OR
    (pv.next_date_3 IS NOT NULL AND pv.next_date_3 > CURRENT_DATE) OR
    (pv.next_date_4 IS NOT NULL AND pv.next_date_4 > CURRENT_DATE) OR
    (pv.next_date_5 IS NOT NULL AND pv.next_date_5 > CURRENT_DATE) OR
    (pv.next_date_6 IS NOT NULL AND pv.next_date_6 > CURRENT_DATE)
  ) AS has_upcoming_restock,
  pv.last_sync_at
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
WHERE pv.is_active = true AND p.is_active = true;

GRANT SELECT ON public.vw_product_availability TO authenticated;

-- ─── 1. fn_get_replenishment_stats ──────────────────────────────
-- Adds restockedLast30Days and expiringSoon to the JSON output.
-- expiringSoon: products restocked ≥23 days ago (≤7 days remaining
-- in the 30-day window — matches statusFromDaysRemaining() in FE).
CREATE OR REPLACE FUNCTION public.fn_get_replenishment_stats()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH
  cfg AS (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS today),
  cenario_a AS (
    SELECT DISTINCT sds.product_id, sds.supplier_id, sds.summary_date
    FROM stock_daily_summary sds
    JOIN products p ON p.id = sds.product_id AND p.is_active = true
    WHERE sds.restock_zero_to_positive = true
      AND COALESCE(sds.stock_close, 0) > 0
      AND sds.summary_date >= (SELECT today FROM cfg) - 30
  ),
  cenario_b AS (
    SELECT DISTINCT sds.product_id, sds.supplier_id, sds.summary_date
    FROM stock_daily_summary sds
    JOIN products p ON p.id = sds.product_id AND p.is_active = true
    WHERE COALESCE(sds.stock_open, 0) > 0
      AND COALESCE(sds.stock_close, 0) > COALESCE(sds.stock_open, 0)
      AND sds.restock_detected = true
      AND sds.summary_date >= (SELECT today FROM cfg) - 30
  ),
  a_hoje AS (
    SELECT COUNT(DISTINCT product_id)::int AS n FROM cenario_a
    WHERE summary_date = (SELECT today FROM cfg)
  ),
  a_7d AS (
    SELECT COUNT(DISTINCT product_id)::int AS n FROM cenario_a
    WHERE summary_date >= (SELECT today FROM cfg) - 7
  ),
  a_15d AS (
    SELECT COUNT(DISTINCT product_id)::int AS n FROM cenario_a
    WHERE summary_date >= (SELECT today FROM cfg) - 15
  ),
  a_30d AS (
    SELECT COUNT(DISTINCT product_id)::int AS n FROM cenario_a
  ),
  -- expiringSoon: restocked ≥23 days ago → ≤7 days remaining in 30d window
  a_expiring AS (
    SELECT COUNT(DISTINCT product_id)::int AS n FROM cenario_a
    WHERE summary_date <= (SELECT today FROM cfg) - 23
  ),
  b_7d AS (
    SELECT COUNT(DISTINCT product_id)::int AS n FROM cenario_b
    WHERE summary_date >= (SELECT today FROM cfg) - 7
  ),
  b_30d AS (
    SELECT COUNT(DISTINCT product_id)::int AS n FROM cenario_b
  ),
  top_a AS (
    SELECT s.name, COUNT(DISTINCT ca.product_id)::int AS cnt
    FROM cenario_a ca
    JOIN suppliers s ON s.id = ca.supplier_id
    WHERE s.name IS NOT NULL
    GROUP BY s.name ORDER BY cnt DESC LIMIT 1
  ),
  ativas AS (
    SELECT
      COUNT(*)::int                                             AS total_var,
      COUNT(*) FILTER (WHERE has_incoming_stock  = true)::int  AS incoming,
      COUNT(*) FILTER (WHERE has_upcoming_restock = true)::int AS upcoming
    FROM vw_product_availability
  )
  SELECT jsonb_build_object(
    'restockedToday',           (SELECT n FROM a_hoje),
    'restockedThisWeek',        (SELECT n FROM a_7d),
    'restockedLast15Days',      (SELECT n FROM a_15d),
    'restockedLast30Days',      (SELECT n FROM a_30d),
    'expiringSoon',             (SELECT n FROM a_expiring),
    'topSupplierName',          COALESCE((SELECT name FROM top_a), null),
    'topSupplierCount',         COALESCE((SELECT cnt  FROM top_a), 0),
    'activeReplenishments',     (SELECT incoming FROM ativas),
    'totalVariants',            (SELECT total_var FROM ativas),
    'replenishmentRate',        ROUND(
                                  (SELECT incoming::numeric FROM ativas)
                                  / NULLIF((SELECT total_var FROM ativas), 0) * 100
                                ),
    'reorderedThisWeek',        (SELECT n FROM b_7d),
    'reorderedThisMonth',       (SELECT n FROM b_30d),
    'upcomingRestockVariants',  (SELECT upcoming FROM ativas),
    '_version',                 'v5_fixes_20260619'
  );
$$;

-- ─── 2. fn_get_reposicao_listing ────────────────────────────────
-- BUG-DB-2: variant_agg now checks all 6 next_date slots.
--   earliest_restock_date = LEAST of all 6 future next_date values.
--   earliest_restock_qty  = total qty across all future slots (renamed
--                           semantically to "total upcoming qty" but column
--                           name preserved to avoid API break).
--   has_upcoming_restock  = BOOL_OR across all 6 slots.
--
-- BUG-DB-3: category_agg falls back to the leaf category itself when no
--   level-1/2 ancestor exists. Removes WHERE d.resolved_id IS NOT NULL
--   (now always non-null since JOIN guarantees c.id).
CREATE OR REPLACE FUNCTION public.fn_get_reposicao_listing(
  p_supplier_id uuid    DEFAULT NULL,
  p_category_id uuid    DEFAULT NULL,
  p_sort_by     text    DEFAULT 'mais_recentes',
  p_limit       integer DEFAULT 48,
  p_offset      integer DEFAULT 0,
  p_days        integer DEFAULT 30
)
RETURNS TABLE(
  product_id            uuid,
  name                  text,
  slug                  text,
  sku                   text,
  sale_price            numeric,
  is_stockout           boolean,
  is_new                boolean,
  total_stock           bigint,
  primary_image_url     text,
  primary_image_cdn     text,
  supplier_id           uuid,
  supplier_name         text,
  supplier_code         text,
  ultimo_restock_date   date,
  earliest_restock_date date,
  earliest_restock_qty  bigint,
  has_upcoming_restock  boolean,
  category_names        text[],
  primary_category_id   uuid,
  primary_category_name text,
  is_low_stock          boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  p_limit := GREATEST(p_limit, 0);
  RETURN QUERY
  WITH
  restock_events AS (
    SELECT DISTINCT ON (g.product_id) g.product_id, g.supplier_id, g.ultimo_restock
    FROM (
      SELECT sd.product_id, sd.supplier_id, MAX(sd.summary_date) AS ultimo_restock
      FROM stock_daily_summary sd
      WHERE sd.restock_zero_to_positive = true
        AND COALESCE(sd.stock_close, 0) > 0
        AND sd.summary_date >= v_today - p_days
      GROUP BY sd.product_id, sd.supplier_id
    ) g
    ORDER BY g.product_id, g.ultimo_restock DESC, g.supplier_id
  ),
  -- BUG-DB-2 fix: check all 6 next_date/next_quantity slots
  variant_agg AS (
    SELECT
      pv.product_id,
      SUM(pv.stock_quantity) AS total_stock,
      LEAST(
        MIN(pv.next_date_1) FILTER (WHERE pv.next_date_1 > v_today),
        MIN(pv.next_date_2) FILTER (WHERE pv.next_date_2 > v_today),
        MIN(pv.next_date_3) FILTER (WHERE pv.next_date_3 > v_today),
        MIN(pv.next_date_4) FILTER (WHERE pv.next_date_4 > v_today),
        MIN(pv.next_date_5) FILTER (WHERE pv.next_date_5 > v_today),
        MIN(pv.next_date_6) FILTER (WHERE pv.next_date_6 > v_today)
      ) AS earliest_restock_date,
      -- total upcoming qty across all 6 slots (column name kept for API compat)
      COALESCE(SUM(pv.next_quantity_1) FILTER (WHERE pv.next_date_1 > v_today), 0)
      + COALESCE(SUM(pv.next_quantity_2) FILTER (WHERE pv.next_date_2 > v_today), 0)
      + COALESCE(SUM(pv.next_quantity_3) FILTER (WHERE pv.next_date_3 > v_today), 0)
      + COALESCE(SUM(pv.next_quantity_4) FILTER (WHERE pv.next_date_4 > v_today), 0)
      + COALESCE(SUM(pv.next_quantity_5) FILTER (WHERE pv.next_date_5 > v_today), 0)
      + COALESCE(SUM(pv.next_quantity_6) FILTER (WHERE pv.next_date_6 > v_today), 0)
        AS earliest_restock_qty,
      BOOL_OR(
        (pv.next_date_1 IS NOT NULL AND pv.next_date_1 > v_today) OR
        (pv.next_date_2 IS NOT NULL AND pv.next_date_2 > v_today) OR
        (pv.next_date_3 IS NOT NULL AND pv.next_date_3 > v_today) OR
        (pv.next_date_4 IS NOT NULL AND pv.next_date_4 > v_today) OR
        (pv.next_date_5 IS NOT NULL AND pv.next_date_5 > v_today) OR
        (pv.next_date_6 IS NOT NULL AND pv.next_date_6 > v_today)
      ) AS has_upcoming_restock
    FROM product_variants pv
    WHERE pv.is_active = true
      AND pv.product_id IN (SELECT re2.product_id FROM restock_events re2)
    GROUP BY pv.product_id
  ),
  primary_imgs AS (
    SELECT DISTINCT ON (pi.product_id) pi.product_id, pi.url_cdn
    FROM product_images pi
    WHERE pi.is_primary = true AND pi.is_active = true
      AND pi.product_id IN (SELECT re3.product_id FROM restock_events re3)
    ORDER BY pi.product_id, pi.updated_at DESC NULLS LAST
  ),
  -- BUG-DB-3 fix: fall back to leaf category when no level-1/2 ancestor exists
  category_agg AS (
    SELECT d.product_id,
      (ARRAY_AGG(d.resolved_name ORDER BY d.resolved_name))[1:3] AS category_names,
      (ARRAY_AGG(d.resolved_id   ORDER BY d.resolved_name))[1]   AS primary_category_id,
      (ARRAY_AGG(d.resolved_name ORDER BY d.resolved_name))[1]   AS primary_category_name
    FROM (
      SELECT DISTINCT pca.product_id,
        COALESCE(
          CASE WHEN c.level  IN (1,2) THEN c.id  END,
          CASE WHEN p1.level IN (1,2) THEN p1.id END,
          CASE WHEN p2.level IN (1,2) THEN p2.id END,
          CASE WHEN p3.level IN (1,2) THEN p3.id END,
          CASE WHEN p4.level IN (1,2) THEN p4.id END,
          c.id   -- fallback: leaf category at any level
        ) AS resolved_id,
        COALESCE(
          CASE WHEN c.level  IN (1,2) THEN c.name  END,
          CASE WHEN p1.level IN (1,2) THEN p1.name END,
          CASE WHEN p2.level IN (1,2) THEN p2.name END,
          CASE WHEN p3.level IN (1,2) THEN p3.name END,
          CASE WHEN p4.level IN (1,2) THEN p4.name END,
          c.name  -- fallback: leaf category name at any level
        ) AS resolved_name
      FROM product_category_assignments pca
      JOIN categories c ON c.id = pca.category_id
      LEFT JOIN categories p1 ON p1.id = c.parent_id
      LEFT JOIN categories p2 ON p2.id = p1.parent_id
      LEFT JOIN categories p3 ON p3.id = p2.parent_id
      LEFT JOIN categories p4 ON p4.id = p3.parent_id
      WHERE pca.product_id IN (SELECT re4.product_id FROM restock_events re4)
    ) d
    -- resolved_id is now always non-null (c.id guaranteed by JOIN)
    GROUP BY d.product_id
  ),
  product_base AS (
    SELECT
      p.id, p.name, p.slug, p.sku, p.sale_price, p.is_stockout, p.is_new,
      re.supplier_id, p.primary_image_url, re.ultimo_restock,
      s.name AS supplier_name, s.code AS supplier_code,
      s.low_stock_threshold,
      pi.url_cdn AS primary_image_cdn,
      COALESCE(va.total_stock, 0) AS total_stock,
      va.earliest_restock_date,
      COALESCE(va.earliest_restock_qty, 0) AS earliest_restock_qty,
      COALESCE(va.has_upcoming_restock, false) AS has_upcoming_restock,
      COALESCE(ca.category_names, ARRAY[]::text[]) AS category_names,
      ca.primary_category_id, ca.primary_category_name
    FROM restock_events re
    JOIN products p  ON p.id = re.product_id AND p.is_active = true
    JOIN suppliers s ON s.id = re.supplier_id
    LEFT JOIN primary_imgs pi ON pi.product_id = p.id
    LEFT JOIN variant_agg va  ON va.product_id = p.id
    LEFT JOIN category_agg ca ON ca.product_id = p.id
    WHERE (p_supplier_id IS NULL OR re.supplier_id = p_supplier_id)
      AND (p_category_id IS NULL OR EXISTS (
            SELECT 1 FROM product_category_assignments pca5
            WHERE pca5.product_id = p.id AND pca5.category_id = p_category_id))
  )
  SELECT
    pb.id, pb.name::text, pb.slug::text, pb.sku::text, pb.sale_price,
    pb.is_stockout, pb.is_new, pb.total_stock,
    pb.primary_image_url::text, pb.primary_image_cdn::text,
    pb.supplier_id, pb.supplier_name::text, pb.supplier_code::text,
    pb.ultimo_restock, pb.earliest_restock_date, pb.earliest_restock_qty,
    pb.has_upcoming_restock, pb.category_names,
    pb.primary_category_id, pb.primary_category_name::text,
    (pb.total_stock > 0
     AND pb.low_stock_threshold IS NOT NULL
     AND pb.total_stock <= pb.low_stock_threshold) AS is_low_stock
  FROM product_base pb
  ORDER BY
    CASE WHEN p_sort_by = 'nome_az'       THEN pb.name        END ASC  NULLS LAST,
    CASE WHEN p_sort_by = 'nome_za'       THEN pb.name        END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'preco_menor'   THEN pb.sale_price  END ASC  NULLS LAST,
    CASE WHEN p_sort_by = 'preco_maior'   THEN pb.sale_price  END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'maior_estoque' THEN pb.total_stock END DESC NULLS LAST,
    CASE WHEN p_sort_by NOT IN ('nome_az','nome_za','preco_menor','preco_maior','maior_estoque')
         THEN pb.ultimo_restock END DESC NULLS LAST,
    pb.id
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- ─── 3. fn_get_reposicao_metrics ────────────────────────────────
-- Codify (was missing from migrations) + add STABLE volatile marker.
CREATE OR REPLACE FUNCTION public.fn_get_reposicao_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today          date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_hoje           int;
  v_7d             int;
  v_15d            int;
  v_30d            int;
  v_top_supplier   text;
  v_top_count      int;
  v_ativas         int;
  v_aguardando     int;
  v_pct_ativas     numeric;
  v_total_vars     int;
  v_data_min       date;
  v_dias_hist      int;
BEGIN
  SELECT
    COUNT(DISTINCT CASE WHEN sd.summary_date = v_today        THEN sd.product_id END),
    COUNT(DISTINCT CASE WHEN sd.summary_date >= v_today - 7   THEN sd.product_id END),
    COUNT(DISTINCT CASE WHEN sd.summary_date >= v_today - 15  THEN sd.product_id END),
    COUNT(DISTINCT CASE WHEN sd.summary_date >= v_today - 30  THEN sd.product_id END),
    MIN(sd.summary_date),
    (v_today - MIN(sd.summary_date))
  INTO v_hoje, v_7d, v_15d, v_30d, v_data_min, v_dias_hist
  FROM stock_daily_summary sd
  JOIN products p ON p.id = sd.product_id
  WHERE sd.restock_zero_to_positive = true
    AND sd.summary_date >= v_today - 30
    AND sd.stock_close > 0
    AND p.is_active = true;

  SELECT s.name, COUNT(DISTINCT sd.product_id)
  INTO v_top_supplier, v_top_count
  FROM stock_daily_summary sd
  JOIN suppliers s ON s.id = sd.supplier_id
  JOIN products p ON p.id = sd.product_id
  WHERE sd.restock_zero_to_positive = true
    AND sd.summary_date >= v_today - 7
    AND sd.stock_close > 0
    AND p.is_active = true
  GROUP BY s.name
  ORDER BY COUNT(DISTINCT sd.product_id) DESC
  LIMIT 1;

  SELECT COUNT(*) INTO v_total_vars
  FROM product_variants WHERE is_active = true;

  SELECT
    COUNT(*) FILTER (
      WHERE pv.stock_quantity = 0
        AND pv.next_date_1 IS NOT NULL AND pv.next_date_1 > v_today
    ),
    COUNT(*) FILTER (
      WHERE pv.next_date_1 IS NOT NULL AND pv.next_date_1 > v_today
    )
  INTO v_ativas, v_aguardando
  FROM product_variants pv
  WHERE pv.is_active = true;

  v_pct_ativas := ROUND(100.0 * v_ativas / NULLIF(v_total_vars, 0), 1);

  RETURN jsonb_build_object(
    'dias_historico_real',   v_dias_hist,
    'data_inicio_historico', v_data_min,
    'aviso_historico',
      CASE WHEN v_dias_hist < 30
           THEN 'Histórico incompleto: ' || v_dias_hist::text || ' dias disponíveis (meta: 30)'
           ELSE 'OK'
      END,
    'repostos_hoje',        v_hoje,
    'repostos_7d',          v_7d,
    'repostos_15d',         v_15d,
    'repostos_30d',         v_30d,
    '7d_igual_15d_aviso',   (v_7d = v_15d AND v_dias_hist < 15),
    'top_supplier_nome',    v_top_supplier,
    'top_supplier_count',   v_top_count,
    'variacoes_ativas_zero_com_previsao',   v_ativas,
    'variacoes_aguardando_lote',            v_aguardando,
    'pct_variacoes_com_reposicao',          v_pct_ativas,
    'gerado_em',   now(),
    'versao',      'v3_stable_20260619'
  );
END;
$$;

-- ─── 4. ACL hardening — BUG-SEC-1 ───────────────────────────────
-- SECURITY DEFINER functions must not be executable by PUBLIC or anon.
-- Only authenticated users and service_role/owner retain access.
REVOKE EXECUTE ON FUNCTION public.fn_get_reposicao_listing(uuid, uuid, text, integer, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_get_reposicao_listing(uuid, uuid, text, integer, integer, integer) FROM anon;
GRANT  EXECUTE ON FUNCTION public.fn_get_reposicao_listing(uuid, uuid, text, integer, integer, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_get_replenishment_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_get_replenishment_stats() FROM anon;
GRANT  EXECUTE ON FUNCTION public.fn_get_replenishment_stats() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_get_reposicao_metrics() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_get_reposicao_metrics() FROM anon;
GRANT  EXECUTE ON FUNCTION public.fn_get_reposicao_metrics() TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
