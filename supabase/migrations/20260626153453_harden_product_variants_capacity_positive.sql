-- Completa as guardas de dimensão física de product_variants: capacity_ml deve ser > 0 quando informado.
-- Alinha ao padrão já existente (chk_pv_size_length / chk_pv_size_width usam > 0). NULL é permitido
-- (produto não-líquido). Verificado: 4.791 variantes com capacidade, min=9, 0 zeros/negativos; dry-run 5/5 OK.
ALTER TABLE public.product_variants ADD CONSTRAINT chk_pv_capacity_ml_positive CHECK (capacity_ml > 0);
