-- ============================================================================
-- E6-L2: color_id via produto mono-variante → match inequívoco de color_id
-- Para imagens sem variant_id mas em produtos com exatamente 1 cor distinta.
-- GAP RESIDUAL: ~550 imagens multi-variante com supplier_code=nome_fornecedor
-- (XBZ/SPOT) — sem discriminador de cor válido. Requer re-importação.
-- ============================================================================
WITH mono_variant AS (
  SELECT product_id, MAX(color_id::text)::uuid AS color_id
  FROM public.product_variants
  WHERE color_id IS NOT NULL
  GROUP BY product_id
  HAVING COUNT(DISTINCT color_id) = 1
)
UPDATE public.product_images pi
SET color_id = mv.color_id
FROM mono_variant mv
WHERE mv.product_id = pi.product_id
  AND pi.applies_to_color = true
  AND pi.color_id IS NULL
  AND pi.is_active = true
  AND pi.variant_id IS NULL;

COMMENT ON COLUMN public.product_images.color_id IS
'FK → color_variations. Identifica a variante de cor desta imagem.
GAP RESIDUAL E6: ~550 imagens (XBZ product, SPOT gallery/logo) têm applies_to_color=true
mas supplier_code contém o nome do fornecedor (XBZ/SPOT) em vez do código de cor real.
Correção requer re-importação com supplier_code correto ou ligação via variant_id.
Não use supplier_code para inferir color_id neste caso.';
