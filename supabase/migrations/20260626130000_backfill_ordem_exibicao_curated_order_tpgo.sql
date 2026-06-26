-- Migration: backfill ordem_exibicao on tabela_preco_gravacao_oficial to CURATED catalog order
-- Date: 2026-06-26
-- Supersedes the initial alphabetical backfill from
--   20260626120000_add_ordem_exibicao_tabela_preco_gravacao_oficial.sql
--
-- Context: ordem_exibicao drives the technique-list UI (read via the 'tecnica_gravacao' bridge alias,
-- ORDER BY ordem_exibicao in useTecnicasList / fetchPromobrindTechniques). The initial backfill ordered
-- rows purely alphabetically by codigo_tabela, which ignored the curated display order already defined in
-- tecnicas_gravacao.ordem_exibicao (16 techniques, distinct values 10..100 with deliberate gaps).
-- This migration re-backfills every row to honor the parent technique's curated order
-- (joined via grupo_tecnica = tecnicas_gravacao.codigo), then codigo_tabela within each group.
-- Deterministic and idempotent: the WHERE ... IS DISTINCT FROM guard makes a re-run a no-op.

WITH ranked AS (
  SELECT t.id,
         row_number() OVER (ORDER BY g.ordem_exibicao, t.codigo_tabela, t.id) AS new_ord
  FROM public.tabela_preco_gravacao_oficial t
  JOIN public.tecnicas_gravacao g ON g.codigo::text = t.grupo_tecnica::text
)
UPDATE public.tabela_preco_gravacao_oficial t
SET ordem_exibicao = ranked.new_ord
FROM ranked
WHERE ranked.id = t.id
  AND t.ordem_exibicao IS DISTINCT FROM ranked.new_ord;

COMMENT ON COLUMN public.tabela_preco_gravacao_oficial.ordem_exibicao IS
'ANTI-REGRESSION (fix 2026-06-26): display order for the technique-list UI. Frontend reads this table via bridge alias tecnica_gravacao (dbInvoke BRIDGE_ALIASES) and ORDERs BY ordem_exibicao; column previously existed only on tecnicas_gravacao, causing PostgREST 400 (42703). NOT NULL DEFAULT 99 (intentionally STRICTER than tecnicas_gravacao.ordem_exibicao which is nullable - prevents ordering surprises). Values backfilled to honor the CURATED order: parent technique tecnicas_gravacao.ordem_exibicao (joined via grupo_tecnica=tecnicas_gravacao.codigo), then codigo_tabela within group. DO NOT DROP.';
