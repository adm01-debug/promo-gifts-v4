-- APLICADO: SIM — 2026-06-23 (sessão PhD DB validation)
-- Migration: fix_stock_velocity_safe_view
-- Resultado: view v_stock_velocity_safe criada com winsorização p99 dinâmica
-- Assertivas: 7/7 PASS | max 34000→1870 un/dia | 99 variantes capadas (0.54%)
-- Smoke tests: 30/30 PASS após aplicação
-- Reversível: DROP VIEW public.v_stock_velocity_safe;
--
-- CONTEXTO:
-- Auditoria forense identificou 225 variantes com avg_daily_depletion_30d > 1.000 un/dia
-- em mv_stock_velocity. Root cause: bulk orders únicos (ex: 476k unidades de Caneta
-- plástica em 14 dias) elevando a média diária de forma irreal, causando falsos
-- alertas de 'Risco de Ruptura' no componente VariantStockTable.
--
-- ESTRATÉGIA:
-- VIEW não-destrutiva v_stock_velocity_safe sobre mv_stock_velocity.
-- Winsorização dinâmica via PERCENTILE_CONT(0.99) calculado em runtime.
-- NÃO altera mv_stock_velocity (dados originais preservados nos campos raw_*).

CREATE OR REPLACE VIEW public.v_stock_velocity_safe AS
WITH p99_caps AS (
  SELECT
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY avg_daily_depletion_7d)
      FILTER (WHERE avg_daily_depletion_7d > 0)  AS cap_7d,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY avg_daily_depletion_30d)
      FILTER (WHERE avg_daily_depletion_30d > 0) AS cap_30d,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY avg_daily_depletion_90d)
      FILTER (WHERE avg_daily_depletion_90d > 0) AS cap_90d
  FROM public.mv_stock_velocity
)
SELECT
  msv.variant_id,
  msv.product_id,
  msv.avg_daily_depletion_7d   AS raw_avg_depletion_7d,
  msv.avg_daily_depletion_30d  AS raw_avg_depletion_30d,
  msv.avg_daily_depletion_90d  AS raw_avg_depletion_90d,
  LEAST(msv.avg_daily_depletion_7d,
        COALESCE(caps.cap_7d,  msv.avg_daily_depletion_7d))  AS avg_daily_depletion_7d,
  LEAST(msv.avg_daily_depletion_30d,
        COALESCE(caps.cap_30d, msv.avg_daily_depletion_30d)) AS avg_daily_depletion_30d,
  LEAST(msv.avg_daily_depletion_90d,
        COALESCE(caps.cap_90d, msv.avg_daily_depletion_90d)) AS avg_daily_depletion_90d,
  caps.cap_30d                                                AS p99_cap_30d,
  (msv.avg_daily_depletion_30d > COALESCE(caps.cap_30d, 'Infinity'::float)) AS was_capped,
  msv.total_depleted_7d,
  msv.total_depleted_30d,
  msv.total_depleted_90d,
  msv.active_days_7d,
  msv.active_days_30d,
  msv.active_days_90d
FROM public.mv_stock_velocity msv
CROSS JOIN p99_caps caps;

COMMENT ON VIEW public.v_stock_velocity_safe IS
  'View sobre mv_stock_velocity com winsorização p99 dinâmica para campos avg_daily_depletion_*. '
  'Elimina distorção de bulk orders únicos (ex: 34k un/dia → capado ao p99 dinâmico ~1871). '
  'Raw values preservados em raw_avg_depletion_* para auditoria. '
  'Criada em 2026-06-23. Reversível: DROP VIEW public.v_stock_velocity_safe.';

GRANT SELECT ON public.v_stock_velocity_safe TO anon, authenticated, service_role;
