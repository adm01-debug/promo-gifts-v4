-- fix_search_analytics_add_seller_id_20260623
-- seller_id GENERATED ALWAYS AS (user_id) STORED
-- HTTP 400 fix for CommercialIntelligencePage + TrendsPage
ALTER TABLE public.search_analytics
  ADD COLUMN IF NOT EXISTS seller_id uuid GENERATED ALWAYS AS (user_id) STORED;
CREATE INDEX IF NOT EXISTS idx_search_analytics_seller_created
  ON public.search_analytics (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_analytics_seller_term_created
  ON public.search_analytics (seller_id, search_term, created_at DESC);
COMMENT ON COLUMN public.search_analytics.seller_id IS
  'Alias gerado de user_id. GENERATED ALWAYS AS (user_id) STORED.';
