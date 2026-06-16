-- ============================================================================
-- E6-L1: Preencher color_id via variant_id → product_variants.color_id
-- Afeta imagens com applies_to_color=true, color_id IS NULL, variant_id SET.
-- JOIN seguro: product_images.variant_id FK → product_variants.id.
-- ============================================================================
UPDATE public.product_images pi
SET color_id = pv.color_id
FROM public.product_variants pv
WHERE pv.id = pi.variant_id
  AND pi.color_id IS NULL
  AND pi.applies_to_color = true
  AND pi.is_active = true
  AND pv.color_id IS NOT NULL;
