-- ============================================================================
-- E5: Gap url_original SPOT intencional — documentação + view atualizada
-- ----------------------------------------------------------------------------
-- SPOT tipos component/location/area (spot-pa-*) são carregados diretamente
-- no Cloudflare Images sem CDN intermediário do fornecedor. url_original=NULL
-- é por design para esses 11.947 registros. Não tente backfill.
-- ============================================================================

COMMENT ON COLUMN public.product_images.url_original IS
'URL no CDN do fornecedor; usada como fallback (primary_image_fallback_url) quando o CF falha.
GAP ESTRUTURAL SPOT: imagens dos tipos component/location/area (spot-pa-*) são carregadas
diretamente no Cloudflare sem CDN intermediário, logo url_original=NULL é por design.
Não tente backfill para esses 11.947 registros. Para demais fornecedores e tipos,
url_original NULL é um gap real passível de correção.';

-- Recriar view com distinção de gap real vs estrutural
DROP VIEW IF EXISTS public.v_product_images_quality_gap;

CREATE VIEW public.v_product_images_quality_gap
WITH (security_invoker = true) AS
SELECT
  pi.source_supplier,
  it.code                                                                     AS image_type,
  count(*)                                                                    AS total,
  count(*) FILTER (WHERE pi.is_active)                                       AS ativas,
  count(*) FILTER (WHERE pi.width_px IS NULL OR pi.height_px IS NULL)        AS sem_dimensoes,
  count(*) FILTER (WHERE pi.format IS NULL)                                   AS sem_format,
  count(*) FILTER (WHERE pi.file_size_bytes IS NULL)                          AS sem_file_size,
  count(*) FILTER (WHERE pi.alt_text IS NULL)                                 AS sem_alt,
  -- gap REAL de url_original (exclui tipos sem URL por design)
  count(*) FILTER (
    WHERE pi.url_original IS NULL
      AND pi.is_active
      AND it.code NOT IN ('component','location','area')
  )                                                                            AS gap_url_original_real,
  -- gap ESTRUTURAL (SPOT print-area, intencional)
  count(*) FILTER (
    WHERE pi.url_original IS NULL
      AND it.code IN ('component','location','area')
  )                                                                            AS gap_url_original_estrutural,
  round(100.0 * count(*) FILTER (WHERE pi.width_px IS NULL OR pi.height_px IS NULL)
        / nullif(count(*), 0), 2)                                             AS pct_sem_dimensoes,
  round(100.0 * count(*) FILTER (WHERE pi.format IS NULL)
        / nullif(count(*), 0), 2)                                             AS pct_sem_format
FROM public.product_images pi
JOIN public.image_types it ON it.id = pi.image_type_id
GROUP BY pi.source_supplier, it.code;

REVOKE ALL ON public.v_product_images_quality_gap FROM anon, authenticated;
GRANT SELECT ON public.v_product_images_quality_gap TO service_role;

COMMENT ON VIEW public.v_product_images_quality_gap IS
'Observabilidade de gaps por fornecedor/tipo. gap_url_original_real=corrigível;
gap_url_original_estrutural=SPOT print-area, intencional (spot-pa-*).
Acesso: service_role only.';
