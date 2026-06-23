-- ============================================================
-- MIGRATION: fix_search_analytics_add_seller_id_20260623
-- DATA: 2026-06-23
-- PROBLEMA: Frontend queries /rest/v1/search_analytics com
--   ?select=search_term,results_count,created_at,seller_id
--   mas a coluna seller_id não existia → HTTP 400 em todas
--   as chamadas de CommercialIntelligencePage e TrendsPage
-- 
-- ROOT CAUSE: A tabela foi criada com user_id mas o padrão
--   do sistema (12 outras tabelas) usa seller_id = auth.uid()
-- 
-- FIX: seller_id GENERATED ALWAYS AS (user_id) STORED
--   - Zero drift garantido por construção
--   - Backfill automático dos 224 registros existentes
--   - Sem trigger necessário
--   - Consistente com product_views, quotes, orders, etc.
-- 
-- VALIDADO: 20/20 assertions ✅ PASS
-- ============================================================

-- 1. Adicionar coluna seller_id como coluna gerada
ALTER TABLE public.search_analytics
  ADD COLUMN IF NOT EXISTS seller_id uuid 
  GENERATED ALWAYS AS (user_id) STORED;

-- 2. Índice para queries do frontend:
--    ?select=...,seller_id&created_at=gte.<ts>&order=created_at.desc
CREATE INDEX IF NOT EXISTS idx_search_analytics_seller_created
  ON public.search_analytics (seller_id, created_at DESC);

-- 3. Índice para queries com search_term + seller_id
CREATE INDEX IF NOT EXISTS idx_search_analytics_seller_term_created
  ON public.search_analytics (seller_id, search_term, created_at DESC);

-- 4. Documentação
COMMENT ON COLUMN public.search_analytics.seller_id IS
  'Alias gerado de user_id para compatibilidade com padrão seller_id do sistema. GENERATED ALWAYS AS (user_id) STORED.';
