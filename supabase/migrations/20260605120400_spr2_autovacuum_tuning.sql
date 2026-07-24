-- ============================================================================
-- supplier_products_raw — Refactor v2 (Fase 5/5): Stats e autovacuum
-- ----------------------------------------------------------------------------
-- O planner superestimava ~20% (reltuples ~19.837 vs real 16.508). Dado o
-- churn de status/imagens, deixamos o autoanalyze/autovacuum mais agressivos
-- nesta tabela quente e atualizamos as estatísticas agora.
-- (fillfactor=90 já foi definido no refactor anterior.)
-- ============================================================================

ALTER TABLE public.supplier_products_raw SET (
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_scale_factor  = 0.05
);

ANALYZE public.supplier_products_raw;
