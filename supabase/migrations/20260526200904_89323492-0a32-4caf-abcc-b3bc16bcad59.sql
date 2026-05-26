ALTER TABLE public.visual_search_feedback 
ADD COLUMN product_id UUID REFERENCES public.products(id),
ADD COLUMN match_relevance FLOAT;
