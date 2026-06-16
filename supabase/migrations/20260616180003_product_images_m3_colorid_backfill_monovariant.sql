-- ============================================================================
-- MELHORIA 3 — color_id backfill INEQUIVOCO (produtos mono-variante)
-- Aplicado em prod via MCP em 2026-06-16; este arquivo espelha o estado.
-- Atribui a unica cor do produto as imagens color-specific sem color_id (1.706 linhas).
-- Multi-variante (14.155) NAO e tocado (ambiguo - requer re-importacao com mapa de cor).
-- https://claude.ai/code/session_01JWqwBkgRNk8v6ejLd18Hv9
-- ============================================================================
UPDATE public.product_images pi
   SET color_id   = mv.cid,
       updated_at = now()
  FROM (
    SELECT product_id, (array_agg(DISTINCT color_id))[1] AS cid
    FROM public.product_variants
    WHERE color_id IS NOT NULL
    GROUP BY product_id
    HAVING count(DISTINCT color_id) = 1
  ) mv
 WHERE pi.product_id = mv.product_id
   AND pi.color_id IS NULL
   AND pi.is_active IS TRUE
   AND EXISTS (SELECT 1 FROM public.image_types it
                WHERE it.id = pi.image_type_id AND it.is_color_specific IS TRUE);
