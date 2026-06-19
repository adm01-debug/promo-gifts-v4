-- DRIFT MIGRATION (2026-06-19): codifica mudanças de runtime do ciclo 2026-06-18/19
-- Esta migration cria os objetos que foram aplicados via MCP ao DB ao vivo,
-- mas nunca registrados como arquivo de migration. É idempotente.
--
-- Ordem importa:
-- 1. category_ancestors (usada por 20260618205528_mv_product_leaf_category_level_first.sql)
-- 2. analytics.mv_product_intelligence com fix abc_classification
-- 3. REVOKE PUBLIC das RPCs de catálogo
-- 4. pg_cron jobs de refresh (idempotente via unschedule+schedule)
-- 5. mv_stock_velocity UNIQUE index
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. CATEGORY_ANCESTORS (closure table)
-- Pré-requisito de 20260618205528 — a MV usa category_ancestors no CASE.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.category_ancestors (
  descendant_id UUID NOT NULL REFERENCES categories(id),
  ancestor_id   UUID NOT NULL REFERENCES categories(id),
  depth         SMALLINT NOT NULL DEFAULT 1,
  PRIMARY KEY (descendant_id, ancestor_id)
);

CREATE INDEX IF NOT EXISTS cat_ancestors_desc_idx
  ON public.category_ancestors (descendant_id, ancestor_id);

CREATE INDEX IF NOT EXISTS cat_ancestors_anc_idx
  ON public.category_ancestors (ancestor_id);

GRANT SELECT ON public.category_ancestors TO anon, authenticated;

-- Popula se vazia (fresh DB após reset)
INSERT INTO public.category_ancestors (descendant_id, ancestor_id, depth)
WITH RECURSIVE closure(descendant_id, ancestor_id, depth) AS (
  SELECT c.id, c.parent_id, 1::smallint
  FROM categories c WHERE c.parent_id IS NOT NULL
  UNION ALL
  SELECT cl.descendant_id, c.parent_id, (cl.depth + 1)::smallint
  FROM closure cl
  JOIN categories c ON c.id = cl.ancestor_id
  WHERE c.parent_id IS NOT NULL AND cl.depth < 10
)
SELECT descendant_id, ancestor_id, depth FROM closure
ON CONFLICT (descendant_id, ancestor_id) DO NOTHING;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. analytics.mv_product_intelligence — FIX abc_classification
-- Bug: produtos com total_depleted_30d=0 recebiam 'B' via percent_rank=0.458
-- Fix: produtos com depletion=0 são SEMPRE 'C'
-- ═════════════════════════════════════════════════════════════════════════════
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_product_intelligence AS
WITH product_metrics AS (
  SELECT
    sv.product_id,
    SUM(sv.total_depleted_30d)       AS total_depleted_30d,
    SUM(sv.total_depleted_90d)       AS total_depleted_90d,
    SUM(sv.current_stock)            AS total_current_stock,
    AVG(sv.avg_daily_depletion_7d)   AS avg_depletion_7d,
    AVG(sv.avg_daily_depletion_30d)  AS avg_depletion_30d,
    MIN(sv.days_to_stockout)         AS min_days_to_stockout,
    MAX(sv.velocity_trend)           AS max_velocity_trend,
    SUM(sv.total_restocked_30d)      AS total_restocked_30d,
    COUNT(*)                         AS supplier_count,
    AVG(sv.current_price)            AS avg_current_price
  FROM analytics.mv_stock_velocity sv
  GROUP BY sv.product_id
),
ranked AS (
  SELECT pm.*,
    percent_rank() OVER (ORDER BY pm.total_depleted_30d DESC) AS depletion_rank
  FROM product_metrics pm
)
SELECT
  product_id, total_depleted_30d, total_depleted_90d, total_current_stock,
  avg_depletion_7d, avg_depletion_30d, min_days_to_stockout, max_velocity_trend,
  total_restocked_30d, supplier_count, avg_current_price,
  CASE
    WHEN (total_depleted_30d = 0 OR total_depleted_30d IS NULL) THEN 'C'::text
    WHEN (depletion_rank <= 0.20)                               THEN 'A'::text
    WHEN (depletion_rank <= 0.50)                               THEN 'B'::text
    ELSE                                                              'C'::text
  END AS abc_classification,
  LEAST(100::numeric,
    ROUND((
      COALESCE(avg_depletion_30d, 0) * 5 +
      CASE WHEN COALESCE(max_velocity_trend, 0) > 1 THEN max_velocity_trend * 10 ELSE 0 END +
      CASE WHEN COALESCE(total_restocked_30d, 0) > 0 THEN 15 ELSE 0 END::numeric
    ), 1)
  ) AS turnover_score,
  ((COALESCE(max_velocity_trend, 0) > 1.5) AND (COALESCE(min_days_to_stockout, 999) < 15))
    AS is_hot_product,
  ((COALESCE(total_depleted_30d, 0) < 5) AND (COALESCE(total_current_stock, 0) > 100))
    AS is_stagnant,
  ((COALESCE(total_depleted_30d, 0) < 5) AND (COALESCE(total_current_stock, 0) > 500))
    AS is_negotiation_opportunity,
  ((COALESCE(min_days_to_stockout, 999) < 7) AND (COALESCE(avg_depletion_30d, 0) > 1))
    AS is_stockout_risk,
  (COALESCE(total_restocked_30d, 0) > COALESCE(total_depleted_30d, 0) * 0.5)
    AS has_frequent_restock,
  NOW() AS refreshed_at
FROM ranked;

-- Índices na MV (idempotente via IF NOT EXISTS não disponível em CREATE UNIQUE INDEX...
-- usar DO block para idempotência)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                 WHERE indexname = 'idx_mv_product_intelligence_product_id_unique'
                 AND schemaname = 'analytics') THEN
    EXECUTE 'CREATE UNIQUE INDEX idx_mv_product_intelligence_product_id_unique
             ON analytics.mv_product_intelligence (product_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                 WHERE indexname = 'idx_mv_product_intelligence_abc'
                 AND schemaname = 'analytics') THEN
    EXECUTE 'CREATE INDEX idx_mv_product_intelligence_abc
             ON analytics.mv_product_intelligence (abc_classification)';
  END IF;
END;
$$;

GRANT SELECT ON analytics.mv_product_intelligence TO authenticated, anon;

-- View pública expondo a MV
CREATE OR REPLACE VIEW public.mv_product_intelligence AS
SELECT product_id, total_depleted_30d, total_depleted_90d, total_current_stock,
       avg_depletion_7d, avg_depletion_30d, min_days_to_stockout, max_velocity_trend,
       total_restocked_30d, supplier_count, avg_current_price, abc_classification,
       turnover_score, is_hot_product, is_stagnant, is_negotiation_opportunity,
       is_stockout_risk, has_frequent_restock, refreshed_at
FROM analytics.mv_product_intelligence;

GRANT SELECT ON public.mv_product_intelligence TO authenticated, anon;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. SEGURANÇA: REVOKE PUBLIC das RPCs de catálogo
-- ═════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  -- Revogar PUBLIC (anon e authenticated continuam com EXECUTE explícito)
  IF EXISTS (SELECT 1 FROM information_schema.routines
             WHERE routine_name = 'fn_get_product_intelligence_all'
             AND routine_schema = 'public') THEN
    REVOKE EXECUTE ON FUNCTION public.fn_get_product_intelligence_all() FROM PUBLIC;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.routines
             WHERE routine_name = 'fn_get_all_leaf_categories'
             AND routine_schema = 'public') THEN
    REVOKE EXECUTE ON FUNCTION public.fn_get_all_leaf_categories() FROM PUBLIC;
  END IF;
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. pg_cron: jobs de refresh automático das MVs
-- ═════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  -- Remover jobs existentes com esses nomes (para idempotência)
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname IN (
    'refresh-mv-product-leaf-category',
    'refresh-analytics-mv-product-intelligence',
    'refresh-category-ancestors'
  );

  -- Job 1: mv_product_leaf_category 2× por dia
  PERFORM cron.schedule(
    'refresh-mv-product-leaf-category',
    '0 3,15 * * *',
    'REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_product_leaf_category'
  );

  -- Job 2: analytics.mv_product_intelligence 1× por dia
  PERFORM cron.schedule(
    'refresh-analytics-mv-product-intelligence',
    '30 2 * * *',
    'REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_product_intelligence'
  );

  -- Job 3: repopular category_ancestors 1× por dia
  PERFORM cron.schedule(
    'refresh-category-ancestors',
    '0 1 * * *',
    $cron$
    TRUNCATE public.category_ancestors;
    INSERT INTO public.category_ancestors (descendant_id, ancestor_id, depth)
    WITH RECURSIVE closure(descendant_id, ancestor_id, depth) AS (
      SELECT c.id, c.parent_id, 1::smallint
      FROM categories c WHERE c.parent_id IS NOT NULL
      UNION ALL
      SELECT cl.descendant_id, c.parent_id, (cl.depth + 1)::smallint
      FROM closure cl JOIN categories c ON c.id = cl.ancestor_id
      WHERE c.parent_id IS NOT NULL AND cl.depth < 10
    )
    SELECT descendant_id, ancestor_id, depth FROM closure;
    $cron$
  );
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. analytics.mv_stock_velocity — UNIQUE index para REFRESH CONCURRENTLY
-- Corrige bug pré-existente: job refresh-all-materialized-views falhava
-- ═════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                 WHERE indexname = 'mv_stock_velocity_pk'
                 AND schemaname = 'analytics') THEN
    EXECUTE 'CREATE UNIQUE INDEX mv_stock_velocity_pk
             ON analytics.mv_stock_velocity (variant_supplier_source_id)';
  END IF;
END;
$$;

COMMENT ON INDEX analytics.mv_stock_velocity_pk IS
'UNIQUE index para habilitar REFRESH MATERIALIZED VIEW CONCURRENTLY.
 Corrige bug pré-existente: job refresh-all-materialized-views falhava com
 ERROR: cannot refresh materialized view concurrently.
 Criado em 2026-06-18 audit; codificado como migration em 2026-06-19.';
