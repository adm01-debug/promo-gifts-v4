-- Feedback dos usuários sobre resultados da busca visual (IA).
-- Referenciada por src/pages/tools/VisualSearchPage.tsx (handleFeedback insert).
-- product_id é text (sem FK): produtos vivem no BD externo, não local.
CREATE TABLE IF NOT EXISTS public.visual_search_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  image_url text,
  original_analysis jsonb,
  is_correct boolean,
  feedback_notes text,
  search_terms jsonb,
  product_id text,
  match_relevance numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.visual_search_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY vsf_insert_authenticated ON public.visual_search_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = (SELECT auth.uid()));
CREATE POLICY vsf_select_own_or_admin ON public.visual_search_feedback
  FOR SELECT USING (((SELECT auth.uid()) = user_id) OR is_admin_or_above((SELECT auth.uid())));
CREATE INDEX IF NOT EXISTS idx_vsf_created_at ON public.visual_search_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vsf_product_id ON public.visual_search_feedback(product_id);
