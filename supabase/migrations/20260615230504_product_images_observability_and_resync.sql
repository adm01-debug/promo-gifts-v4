-- ============================================================================
-- product_images :: observabilidade de qualidade + resync set-based  (Migration 4/5)
-- ----------------------------------------------------------------------------
-- (1) View de monitoramento dos gaps de metadados por fornecedor.
-- (2) fn_resync_product_media(): recomputa, em UMA passada set-based, os campos
--     desnormalizados de `products` (images, og_image_url, primary_image_url,
--     primary_image_fallback_url, set_image_url). Replica a lógica de
--     fn_sync_product_images_to_products + fn_sync_set_image_url. Uso: cargas em
--     massa podem desabilitar os triggers AFTER por-linha e chamar isto 1x no fim,
--     eliminando a amplificação de escrita (N updates em products -> 1).
-- NOTA: a versão DETERMINÍSTICA final está na migration 20260615230505.
-- ============================================================================

-- (1) Observabilidade -------------------------------------------------------
CREATE OR REPLACE VIEW public.v_product_images_quality_gap
WITH (security_invoker = true) AS
SELECT
  source_supplier,
  count(*)                                                         AS total,
  count(*) FILTER (WHERE is_active)                                AS ativas,
  count(*) FILTER (WHERE width_px IS NULL OR height_px IS NULL)    AS sem_dimensoes,
  count(*) FILTER (WHERE format IS NULL)                           AS sem_format,
  count(*) FILTER (WHERE file_size_bytes IS NULL)                  AS sem_file_size,
  count(*) FILTER (WHERE alt_text IS NULL)                         AS sem_alt,
  round(100.0 * count(*) FILTER (WHERE width_px IS NULL)
        / nullif(count(*), 0), 2)                                  AS pct_sem_dimensoes
FROM public.product_images
GROUP BY source_supplier;

-- (2) Resync set-based (versão inicial; substituída pela determinística) -----
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
          is_primary DESC, display_order ASC NULLS LAST)
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
                 is_primary DESC, display_order ASC NULLS LAST LIMIT 1) AS og_url,
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
                 is_primary DESC, display_order ASC NULLS LAST LIMIT 1) AS primary_url,
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
                 is_primary DESC, display_order ASC NULLS LAST LIMIT 1) AS fallback_url,
      ( SELECT url_cdn FROM product_images
        WHERE product_id=t.id AND is_active AND image_type='set'
        ORDER BY display_order ASC, created_at ASC LIMIT 1) AS set_url
    FROM targets t
  )
  UPDATE products p SET
    images                     = agg.images,
    og_image_url               = agg.og_url,
    primary_image_url          = agg.primary_url,
    primary_image_fallback_url = agg.fallback_url,
    set_image_url              = agg.set_url
  FROM agg WHERE p.id = agg.product_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_resync_product_media(uuid[]) FROM anon, authenticated;
