ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_freshness_threshold_days INTEGER DEFAULT 60;
COMMENT ON COLUMN public.products.price_freshness_threshold_days IS 'Número de dias até que o preço de um produto seja considerado desatualizado.';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;