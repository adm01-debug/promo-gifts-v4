-- ================================================================
-- Migration: fix_search_analytics_seller_id_not_generated
-- Date: 2026-06-23
--
-- BUG: A migration anterior (20260623_fix_search_analytics_add_seller_id.sql)
-- adicionou seller_id como GENERATED ALWAYS AS (user_id) STORED.
-- PostgREST v12 (Supabase) EXCLUI colunas GENERATED ALWAYS do schema cache,
-- causando HTTP 400 em todas as queries REST com seller_id no select.
-- Afetava: TrendsPage.tsx (3 padrões de query), commercial intelligence.
--
-- FIX: Substituir a coluna gerada por coluna regular uuid + trigger BEFORE INSERT
--      para auto-popular seller_id = user_id. Padrão idêntico a product_views.
-- ================================================================

-- STEP 1: Drop da coluna gerada (CASCADE remove índices dependentes)
ALTER TABLE public.search_analytics DROP COLUMN IF EXISTS seller_id;

-- STEP 2: Adicionar coluna regular
ALTER TABLE public.search_analytics ADD COLUMN seller_id uuid;

-- STEP 3: Popular dados existentes
UPDATE public.search_analytics SET seller_id = user_id;

-- STEP 4: Recriar índices
CREATE INDEX IF NOT EXISTS idx_search_analytics_seller_created
  ON public.search_analytics USING btree (seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_analytics_seller_term_created
  ON public.search_analytics USING btree (seller_id, search_term, created_at DESC);

-- STEP 5: Trigger para manter seller_id sincronizado com user_id
CREATE OR REPLACE FUNCTION public.fn_sync_search_analytics_seller_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.seller_id := NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_search_analytics_seller_id
  ON public.search_analytics;

CREATE TRIGGER trg_sync_search_analytics_seller_id
  BEFORE INSERT OR UPDATE OF user_id
  ON public.search_analytics
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_search_analytics_seller_id();

-- STEP 6: Reload schema PostgREST
NOTIFY pgrst, 'reload schema';
