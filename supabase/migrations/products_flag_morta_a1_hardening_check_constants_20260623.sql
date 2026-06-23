-- Melhoria A: CHECKs de imutabilidade em FLAG-MORTA + COMMENTs
ALTER TABLE public.products ADD CONSTRAINT chk_products_robots_meta_constant CHECK (robots_meta IS NULL OR robots_meta = 'index, follow') NOT VALID;
ALTER TABLE public.products VALIDATE CONSTRAINT chk_products_robots_meta_constant;
ALTER TABLE public.products ADD CONSTRAINT chk_products_price_freshness_constant CHECK (price_freshness_threshold_days IS NULL OR (price_freshness_threshold_days >= 1 AND price_freshness_threshold_days <= 365)) NOT VALID;
ALTER TABLE public.products VALIDATE CONSTRAINT chk_products_price_freshness_constant;
COMMENT ON COLUMN public.products.robots_meta IS 'FLAG-MORTA: constante index, follow. CHECK imutabilidade. 2026-06-23.';
COMMENT ON COLUMN public.products.price_freshness_threshold_days IS 'FLAG-MORTA: constante 60. CHECK range 1-365. 2026-06-23.';
COMMENT ON COLUMN public.products.organization_id IS 'FLAG-MORTA: 1 valor (org Promo Brindes). NÃO dropar: RLS depende. 2026-06-23.';