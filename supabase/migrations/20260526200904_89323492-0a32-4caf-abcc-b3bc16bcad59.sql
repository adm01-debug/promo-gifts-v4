ALTER TABLE public.visual_search_feedback 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id),
ADD COLUMN IF NOT EXISTS match_relevance FLOAT;
