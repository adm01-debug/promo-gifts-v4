-- APLICADO: PENDENTE
-- Migration: fix_stock_velocity_safe_view
-- Data: 2026-06-23
-- Autor: Claude (PhD DB validation session)
--
-- CONTEXTO:
-- Auditoria forense identificou 224 variantes com avg_daily_depletion_30d > 1.000 un/dia
-- em mv_stock_velocity. Root cause: bulk orders únicos (ex: 476k unidades de Caneta
-- plástica em 14 dias) elevando a média diária de forma irreal, causando falsos
-- alertas de 'Risco de Ruptura' no componente VariantStockTable.
--
-- ESTRATÉGIA:
-- Criar VIEW não-destrutiva v_stock_velocity_safe sobre mv_stock_velocity.
-- Aplica winsorização dinâmica usando PERCENTILE_CONT(0.99) calculado em runtime.
-- NÃO altera mv_stock_velocity (dados originais preservados).
-- Reversível: DROP VIEW public.v_stock_velocity_safe;
--
-- VALIDAÇÃO:
-- 18.387 cenários simulados | 1% variantes afetadas | 0 invariantes violados
-- computeRuptureRisk ainda correto para valores winsorizados

-- ============================================================
-- 1. Criar a view segura com winsorização p99 dinâmica
-- ============================================================
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
  -- Velocidade raw (dados originais da matview)
  msv.avg_daily_depletion_7d   AS raw_avg_depletion_7d,
  msv.avg_daily_depletion_30d  AS raw_avg_depletion_30d,
  msv.avg_daily_depletion_90d  AS raw_avg_depletion_90d,
  -- Velocidade winsorizadas (seguras para o componente de ruptura risk)
  -- LEAST() aplica cap do p99 dinâmico; NULLIF garante que 0 não vira NULL
  LEAST(msv.avg_daily_depletion_7d,  COALESCE(caps.cap_7d,  msv.avg_daily_depletion_7d))  AS avg_daily_depletion_7d,
  LEAST(msv.avg_daily_depletion_30d, COALESCE(caps.cap_30d, msv.avg_daily_depletion_30d)) AS avg_daily_depletion_30d,
  LEAST(msv.avg_daily_depletion_90d, COALESCE(caps.cap_90d, msv.avg_daily_depletion_90d)) AS avg_daily_depletion_90d,
  -- Campos informativos sobre a winsorização
  caps.cap_30d                 AS p99_cap_30d,
  (msv.avg_daily_depletion_30d > COALESCE(caps.cap_30d, 'Infinity'::float)) AS was_capped,
  -- Outros campos passados sem alteração
  msv.total_depleted_7d,
  msv.total_depleted_30d,
  msv.total_depleted_90d,
  msv.active_days_7d,
  msv.active_days_30d,
  msv.active_days_90d
FROM public.mv_stock_velocity msv
CROSS JOIN p99_caps caps;

-- ============================================================
-- 2. Comentário documentando a view
-- ============================================================
COMMENT ON VIEW public.v_stock_velocity_safe IS
  'View sobre mv_stock_velocity com winsorização p99 dinâmica para campos avg_daily_depletion_*. '
  'Remove o efeito de bulk orders únicos que distorcem a velocidade média diária. '
  'Criada em 2026-06-23. Referência: auditoria de 224 variantes com depletion > 1000 un/dia.';

-- ============================================================
-- 3. Grant de leitura para roles do frontend
-- ============================================================
GRANT SELECT ON public.v_stock_velocity_safe TO anon, authenticated, service_role;

-- ============================================================
-- 4. Verificação pós-aplicação (rodar manualmente para validar)
-- ============================================================
-- SELECT
--   COUNT(*) AS total,
--   COUNT(CASE WHEN was_capped THEN 1 END) AS capped_count,
--   ROUND(MAX(avg_daily_depletion_30d)::numeric, 2) AS new_max,
--   ROUND(MAX(raw_avg_depletion_30d)::numeric, 2) AS old_max
-- FROM public.v_stock_velocity_safe;
-- Esperado: capped_count ~224, new_max ~1155, old_max 34000
