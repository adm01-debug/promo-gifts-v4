-- ============================================================================
-- MELHORIA 2 — display_order deterministico por (product_id, color_id, image_type)
-- Aplicado em prod via MCP em 2026-06-16; este arquivo espelha o estado.
-- Primaria sempre 1a; desempate por (display_order, created_at, id). Elimina 18.484 colisoes -> 0.
-- Reversivel (snapshot backup.product_images_display_order_20260616). ~55.764 linhas reordenadas.
-- Suprime amplificacao de triggers (session_replication_role=replica) + resync determinístico.
-- https://claude.ai/code/session_01JWqwBkgRNk8v6ejLd18Hv9
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS backup;
DROP TABLE IF EXISTS backup.product_images_display_order_20260616;
CREATE TABLE backup.product_images_display_order_20260616 AS
  SELECT id, display_order, now() AS snapshot_at
  FROM public.product_images WHERE is_active;

SET LOCAL session_replication_role = replica;

WITH reseq AS (
  SELECT id,
         row_number() OVER (PARTITION BY product_id, color_id, image_type
                            ORDER BY (NOT is_primary), display_order, created_at, id) AS new_order
  FROM public.product_images
  WHERE is_active
)
UPDATE public.product_images p
   SET display_order = r.new_order,
       updated_at    = now()
  FROM reseq r
 WHERE p.id = r.id
   AND p.display_order IS DISTINCT FROM r.new_order;

SET LOCAL session_replication_role = origin;
SELECT public.fn_resync_product_media(
  ARRAY(SELECT DISTINCT product_id FROM public.product_images WHERE is_active)
);
