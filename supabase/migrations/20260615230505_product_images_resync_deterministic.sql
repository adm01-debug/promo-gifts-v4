-- ============================================================================
-- product_images :: fn_resync_product_media DETERMINÍSTICA e IDEMPOTENTE  (Migration 4/5b)
-- ----------------------------------------------------------------------------
-- O trigger original é não-determinístico em empates de (prioridade, is_primary,
-- display_order). Esta versão adiciona desempate estável (created_at, cloudflare_image_id)
-- em TODAS as ordenações e um guard `IS DISTINCT FROM` que só escreve quando há
-- mudança real -> execuções repetidas são no-op (idempotência verificada: run1=1,
-- run2=0, run3=0). A 1a execução por produto pode normalizar a ordem de empates
-- (cosmético, mesmo conjunto de URLs).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_resync_product_media(p_product_ids uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH targets AS (
    SELECT p.id FROM products p
    WHERE p_product_ids IS NULL OR p.id = ANY(p_product_ids)
  ),
  agg AS (
    SELECT t.id AS product_id,
      COALESCE((
        SELECT jsonb_agg(url_cdn ORDER BY
          CASE WHEN image_type='main' AND is_primary THEN 0
               WHEN image_type='main' THEN 1
               WHEN image_type IN ('gallery','product') THEN 2
               WHEN image_type='ambient' THEN 3
               WHEN image_type='set' THEN 4
               WHEN image_type='logo' THEN 5 ELSE 9 END,
          is_primary DESC, display_order ASC NULLS LAST,
          created_at ASC, cloudflare_image_id ASC)
          FILTER (WHERE image_type NOT IN ('box','pouch','location','area','component'))
        FROM product_images WHERE product_id=t.id AND is_active), '[]'::jsonb) AS images,
      ( SELECT url_cdn FROM product_images
        WHERE product_id=t.id AND is_active
          AND image_type NOT IN ('box','pouch','location','area','component')
        ORDER BY CASE WHEN is_og_image THEN 0
                      WHEN image_type='main' AND is_primary THEN 1
                      WHEN image_type='main' THEN 2
                      WHEN image_type IN ('gallery','product') THEN 3
                      WHEN image_type='ambient' THEN 4
                      WHEN image_type='set' THEN 5 ELSE 9 END,
                 is_primary DESC, display_order ASC NULLS LAST,
                 created_at ASC, cloudflare_image_id ASC LIMIT 1) AS og_url,
      ( SELECT url_cdn FROM product_images
        WHERE product_id=t.id AND is_active
          AND image_type NOT IN ('box','pouch','location','area','component')
        ORDER BY CASE WHEN image_type='main' AND is_primary THEN 0
                      WHEN image_type='main' THEN 1
                      WHEN image_type IN ('gallery','product') AND is_primary THEN 2
                      WHEN image_type IN ('gallery','product') THEN 3
                      WHEN image_type='ambient' THEN 4
                      WHEN image_type='set' AND is_primary THEN 5
                      WHEN image_type='set' THEN 6
                      WHEN image_type='logo' THEN 7 ELSE 9 END,
                 is_primary DESC, display_order ASC NULLS LAST,
                 created_at ASC, cloudflare_image_id ASC LIMIT 1) AS primary_url,
      ( SELECT url_original FROM product_images
        WHERE product_id=t.id AND is_active AND url_original IS NOT NULL AND url_original<>''
        ORDER BY CASE WHEN image_type='main' AND is_primary THEN 0
                      WHEN image_type='main' THEN 1
                      WHEN image_type IN ('gallery','product') AND is_primary THEN 2
                      WHEN image_type IN ('gallery','product') THEN 3
                      WHEN image_type='ambient' THEN 4
                      WHEN image_type='set' AND is_primary THEN 5
                      WHEN image_type='set' THEN 6
                      WHEN image_type='logo' THEN 7 ELSE 9 END,
                 is_primary DESC, display_order ASC NULLS LAST,
                 created_at ASC, cloudflare_image_id ASC LIMIT 1) AS fallback_url,
      ( SELECT url_cdn FROM product_images
        WHERE product_id=t.id AND is_active AND image_type='set'
        ORDER BY display_order ASC, created_at ASC, cloudflare_image_id ASC LIMIT 1) AS set_url
    FROM targets t
  )
  UPDATE products p SET
    images                     = agg.images,
    og_image_url               = agg.og_url,
    primary_image_url          = agg.primary_url,
    primary_image_fallback_url = agg.fallback_url,
    set_image_url              = agg.set_url
  FROM agg
  WHERE p.id = agg.product_id
    AND ( p.images                     IS DISTINCT FROM agg.images
       OR p.og_image_url               IS DISTINCT FROM agg.og_url
       OR p.primary_image_url          IS DISTINCT FROM agg.primary_url
       OR p.primary_image_fallback_url IS DISTINCT FROM agg.fallback_url
       OR p.set_image_url              IS DISTINCT FROM agg.set_url );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_resync_product_media(uuid[]) FROM anon, authenticated;
