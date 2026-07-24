-- =============================================================================
-- APLICADO em produção via Supabase MCP (project doufsxqlfjyuvxuezpln) — NÃO re-executar.
-- Bug: POST /rest/v1/search_analytics -> 400 (Postgres 23514, violação de CHECK).
-- Causa raiz: a constraint chk_results_count_range limitava results_count a <= 2000,
--   porém o catálogo ativo tem ~7.156 produtos. Buscas/listagens amplas registram
--   results_count > 2000 -> INSERT rejeitado -> 400 no console + perda de telemetria
--   de busca (a chamada é fire-and-forget, então a UI não quebra, mas o dado se perde).
-- Correção: ampliar o teto do CHECK de 2000 para 1.000.000, preservando o piso
--   sentinela (-1) e a tolerância a NULL. Registrar a contagem real é mais útil do
--   que truncá-la; 1e6 é um teto de sanidade (não existe listagem legítima maior).
-- Impacto: zero migração de dados; apenas a constraint é substituída. Reversível.
-- Verificação: INSERT de prova com results_count=7156 ACEITO e removido em seguida.
-- =============================================================================

ALTER TABLE public.search_analytics
  DROP CONSTRAINT IF EXISTS chk_results_count_range;

ALTER TABLE public.search_analytics
  ADD CONSTRAINT chk_results_count_range
  CHECK (results_count IS NULL OR (results_count >= -1 AND results_count <= 1000000));
