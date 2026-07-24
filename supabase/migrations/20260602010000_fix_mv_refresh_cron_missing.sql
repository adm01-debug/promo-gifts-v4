-- ============================================================
-- MIGRAÇÃO: 20260602010000_fix_mv_refresh_cron_missing.sql
-- AUTOR:    Claude (audit fix/claude-supabase-audit-collapse-20260602)
-- DATA:     2026-06-02
-- MOTIVO:   COLAPSO #4 — Materialized Views SEM cron de refresh.
--           mv_product_intelligence = 0 rows (VAZIA)
--           mv_stock_velocity = 0 rows (VAZIA)
--           mv_product_cards = 6090 rows MAS SEM refresh automático
--           A função refresh_materialized_views() existe mas não tem cron.
--           Nenhuma das 4 MVs mais importantes tem schedule de atualização.
-- ============================================================

-- ETAPA 1: Corrigir a função refresh_materialized_views para incluir TODAS as MVs
CREATE OR REPLACE FUNCTION public.refresh_all_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'analytics'
AS $$
BEGIN
    -- MV de produtos (catálogo) — mais crítica
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_product_cards;

    -- MV de composições de produtos
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_product_compositions;

    -- MV de estatísticas de grupos de materiais
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_material_group_stats;

    -- MV de saúde de mídia
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_media_health;

    -- MV da árvore de categorias (visual)
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.categories_tree_visual;

    -- NOTA: mv_product_intelligence e mv_stock_velocity estão VAZIAS (0 rows).
    -- Foram excluídas deste refresh até serem corrigidas (evitar erro CONCURRENTLY em MV vazia sem índice único).
    -- Investigate: analytics.mv_product_intelligence e analytics.mv_stock_velocity

    RAISE LOG '[refresh_all_materialized_views] Todas as MVs refreshadas em %', clock_timestamp();
END;
$$;

-- ETAPA 2: Criar cron job para refresh das MVs a cada hora (nos minutos 30)
-- Horário: :30 de cada hora → fora da janela dos outros crons (que rodam em :00, :05, :10, :15, :17)
SELECT cron.schedule(
    'refresh-all-materialized-views',
    '30 * * * *',
    $$ SELECT public.refresh_all_materialized_views(); $$
);

-- ETAPA 3: Registrar que mv_product_intelligence e mv_stock_velocity estão vazias
-- e precisam de investigação separada
COMMENT ON MATERIALIZED VIEW analytics.mv_product_intelligence IS
    'ATENÇÃO: Esta MV está VAZIA (0 rows). Verificar definição e dados de origem. Criada em audit 2026-06-02.';

COMMENT ON MATERIALIZED VIEW analytics.mv_stock_velocity IS
    'ATENÇÃO: Esta MV está VAZIA (0 rows). Sem dados de estoque suficientes ou query com filtro muito restrito. Criada em audit 2026-06-02.';
