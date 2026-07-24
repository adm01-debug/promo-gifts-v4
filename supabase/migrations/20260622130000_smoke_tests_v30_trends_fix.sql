-- ============================================================
-- MIGRATION: smoke_tests_v30_trends_fix
-- STATUS: APLICADO em produção via execute_sql 2026-06-22
-- 30 testes (28 originais + 2 novos)
-- Testes de trends atualizados para objetos reais:
--   product_views (862 views), get_trending_products,
--   fn_generate_trends_insights, saved_trends_views
-- ============================================================
-- ATENÇÃO: O Lovable bot pode sobrescrever esta função.
-- Para garantir a versão correta, use execute_sql (não apply_migration).
-- Resultado esperado: 30/30 PASS
-- ============================================================

-- DROP FUNCTION IF EXISTS public.fn_run_smoke_tests();
-- [DDL completo em supabase/migrations/20260622111500_supplier_reliability_pipeline_v1.sql]
-- Esta migração é documentacional — a função foi aplicada via execute_sql
-- por conflito de concorrência com o Lovable bot.

-- Novos smoke tests adicionados nesta sessão:
-- 29: ai_queue_cleanup_cron_exists → cron job 154 'ai-queue-stuck-cleanup' ativo
-- 30: asia_bronze_linkage_healthy  → ASIA Bronze ≤10 não linkados (4 pending catalog)

-- VERIFICAÇÃO:
-- SELECT COUNT(*) FILTER (WHERE result LIKE '%PASS%') FROM fn_run_smoke_tests();
-- Resultado esperado: 30
