-- M3: 5 novos CHECKs validados (total: 30)
ALTER TABLE public.products ADD CONSTRAINT chk_products_min_quantity_pos CHECK (min_quantity IS NULL OR min_quantity >= 1) NOT VALID;
ALTER TABLE public.products VALIDATE CONSTRAINT chk_products_min_quantity_pos;
ALTER TABLE public.products ADD CONSTRAINT chk_products_capacity_ml_pos CHECK (capacity_ml IS NULL OR capacity_ml > 0) NOT VALID;
ALTER TABLE public.products VALIDATE CONSTRAINT chk_products_capacity_ml_pos;
ALTER TABLE public.products ADD CONSTRAINT chk_products_lead_time_nonneg CHECK (lead_time_days IS NULL OR lead_time_days >= 0) NOT VALID;
ALTER TABLE public.products VALIDATE CONSTRAINT chk_products_lead_time_nonneg;
ALTER TABLE public.products ADD CONSTRAINT chk_products_ipi_rate_range CHECK (ipi_rate IS NULL OR (ipi_rate >= 0 AND ipi_rate <= 100)) NOT VALID;
ALTER TABLE public.products VALIDATE CONSTRAINT chk_products_ipi_rate_range;
ALTER TABLE public.products ADD CONSTRAINT chk_products_circumference_pos CHECK (circumference_cm IS NULL OR circumference_cm > 0) NOT VALID;
ALTER TABLE public.products VALIDATE CONSTRAINT chk_products_circumference_pos;
