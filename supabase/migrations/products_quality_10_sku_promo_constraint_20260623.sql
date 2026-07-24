-- Melhoria 10: sku_promo CHECK (= sku em 100% dos registros)
ALTER TABLE public.products ADD CONSTRAINT chk_products_sku_promo_equals_sku CHECK (sku_promo IS NULL OR sku_promo = sku) NOT VALID;
ALTER TABLE public.products VALIDATE CONSTRAINT chk_products_sku_promo_equals_sku;
COMMENT ON COLUMN public.products.sku_promo IS 'SKU Promo (legacy). 100% igual ao sku. CHECK de igualdade. Candidato a DROP após refatoração TS types. 2026-06-23.';