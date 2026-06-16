-- ============================================================================
-- MELHORIA 7 — Re-sequencia display_order APOS a reclassificacao M5
-- Aplicado em prod via MCP em 2026-06-16; este arquivo espelha o estado.
-- A M5 alterou image_type (particao de ordenacao) de 7.779 linhas, reintroduzindo 10.484 colisoes.
-- Esta passada restaura a invariante determinística (colisoes estritas -> 0). Idempotente.
-- Reversibilidade: snapshot original em backup.product_images_display_order_20260616 (M2).
-- https://claude.ai/code/session_01JWqwBkgRNk8v6ejLd18Hv9
-- ============================================================================
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
