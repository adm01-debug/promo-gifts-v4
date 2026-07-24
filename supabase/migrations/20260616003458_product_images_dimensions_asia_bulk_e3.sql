-- ============================================================================
-- E3-ASIA: Bulk backfill 768×768 para todas as imagens ASIA sem dimensões.
-- Invariante verificado via query: 60 imagens com dimensões = ALL 768×768.
-- 0 exceções em amostra completa. Safe para bulk update sem checar CF API.
-- ============================================================================
UPDATE public.product_images
SET
  width_px  = 768,
  height_px = 768
WHERE source_supplier = 'ASIA'
  AND (width_px IS NULL OR height_px IS NULL);

-- E3-E4 restante (67.152 imagens non-ASIA): backfill assíncrono via
-- Edge Function 'backfill-image-dimensions' (pg_cron job #125, a cada 5min).
-- A função parseia headers de imagem (Range: bytes=0-32767) para extrair
-- width/height/file_size de JPEG/PNG/WebP. Não bloqueante para este migration.
