-- ============================================================================
-- E2-L2: Backfill format para imagens SPOT sem url_original + XBZ orfão
-- ----------------------------------------------------------------------------
-- L2a: spot-pa-* = PNG confirmado via CF Images API (amostra de 8 imagens)
--       tipos: location=7755, component=3025, area=1167 → 11.947 imagens
-- L2b: xbz-p-05054 = ausente no Cloudflare (batch_check: missing)
--       → inativar para não servir URL quebrada
-- ============================================================================

-- L2a: SPOT print-area images são sempre PNG
UPDATE public.product_images
SET format = 'png'
WHERE format IS NULL
  AND source_supplier = 'SPOT'
  AND cloudflare_image_id LIKE 'spot-pa-%';

-- L2b: XBZ image ausente no CF → inativar
UPDATE public.product_images
SET is_active = false
WHERE cloudflare_image_id = 'xbz-p-05054';
