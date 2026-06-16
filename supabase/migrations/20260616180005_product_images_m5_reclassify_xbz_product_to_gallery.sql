-- ============================================================================
-- MELHORIA 5 — Reclassifica XBZ image_type 'product' (generico) -> 'gallery'
-- Aplicado em prod via MCP em 2026-06-16; este arquivo espelha o estado.
-- 7.779 ativas, todas NAO-primarias (Vista Alternativa). Reversivel (snapshot).
-- Atualiza texto + FK explicitamente (replica mode) e resync escopado aos produtos afetados.
-- Resultado: balde generico 'product' zerado; drift texto<->FK = 0.
-- https://claude.ai/code/session_01JWqwBkgRNk8v6ejLd18Hv9
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS backup;
CREATE TABLE IF NOT EXISTS backup.product_images_type_xbz_20260616 AS
  SELECT id, product_id, image_type, image_type_id, now() AS snapshot_at
  FROM public.product_images
  WHERE source_supplier='XBZ' AND image_type='product' AND is_active;

SET LOCAL session_replication_role = replica;

UPDATE public.product_images
   SET image_type    = 'gallery',
       image_type_id = '1590e144-e3f8-41e6-98f9-f4a25bae496d',  -- code='gallery' (Vista Alternativa)
       updated_at    = now()
 WHERE source_supplier='XBZ' AND image_type='product' AND is_active;

SET LOCAL session_replication_role = origin;

SELECT public.fn_resync_product_media(
  ARRAY(SELECT DISTINCT product_id FROM backup.product_images_type_xbz_20260616)
);
