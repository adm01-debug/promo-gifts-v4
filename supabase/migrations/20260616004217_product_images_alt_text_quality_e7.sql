-- ============================================================================
-- E7: Resetar alt_text curto (<20 chars) ou NULL → trigger auto-regenera
-- ----------------------------------------------------------------------------
-- O trigger trg_product_images_seo_autofill (BEFORE INSERT OR UPDATE) chama
-- generate_image_alt_text() quando alt_text IS NULL ou TRIM=''. Resultado
-- garantido ≥35 chars ("produto - tipo - Brinde Promocional").
-- Texto anterior preservado em caption para auditoria antes do reset.
-- ============================================================================
UPDATE public.product_images
SET
  caption  = COALESCE(NULLIF(trim(caption), ''), alt_text),  -- preserva texto anterior
  alt_text = NULL                           -- trigger BEFORE UPDATE regenera
WHERE (alt_text IS NULL OR (length(trim(alt_text)) < 20))
  AND is_active = true;
