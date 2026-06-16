-- ============================================================================
-- E1: mv_product_images_audit — visão audit completa, 7 dimensões de qualidade
-- Score 0-100, prioridade_correcao, gap_* flags por linha.
-- pg_cron refresh a cada 6h (job 'refresh-mv-product-images-audit').
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS public.mv_product_images_audit;

CREATE MATERIALIZED VIEW public.mv_product_images_audit AS
SELECT
  pi.id,
  pi.product_id,
  pi.cloudflare_image_id,
  pi.source_supplier,
  pi.organization_id,
  pi.created_at,
  pi.updated_at,
  it.code                  AS image_type_code,
  it.category              AS image_type_category,
  it.subcategory           AS image_type_subcategory,
  it.is_color_specific,
  it.show_in_gallery,
  it.show_in_simulator,
  it.is_primary_candidate,
  it.display_priority,
  pi.is_active,
  pi.is_primary,
  pi.is_og_image,
  pi.display_order,
  pi.url_cdn,
  pi.url_original,
  pi.filename,
  pi.format,
  pi.width_px,
  pi.height_px,
  pi.file_size_bytes,
  pi.color_id,
  pi.variant_id,
  pi.applies_to_color,
  pi.supplier_code,
  pi.alt_text,
  length(pi.alt_text)      AS alt_length,
  pi.title_text,
  pi.caption,
  -- ─── GAP FLAGS (true = falta algo) ────────────────────────────────────────
  (pi.format IS NULL)                                                              AS gap_format,
  (pi.width_px IS NULL OR pi.height_px IS NULL)                                   AS gap_dimensoes,
  (pi.file_size_bytes IS NULL)                                                     AS gap_file_size,
  (pi.url_original IS NULL
    AND pi.is_active = true
    AND NOT (pi.source_supplier = 'SPOT' AND it.code IN ('component','location','area'))) AS gap_url_original,
  -- applies_to_color (boolean do registro) — não is_color_specific da FK
  (pi.applies_to_color = true
    AND pi.color_id IS NULL
    AND pi.is_active = true)                                                       AS gap_color_id,
  (pi.alt_text IS NULL OR length(pi.alt_text) < 20)                               AS gap_alt_quality,
  (pi.image_type IS DISTINCT FROM it.code)                                        AS gap_image_type_drift,
  -- ─── SCORE DE COMPLETUDE (0-100, média de 7 dimensões) ────────────────────
  ROUND(100.0 * (
    (pi.format IS NOT NULL)::int +
    (pi.width_px IS NOT NULL AND pi.height_px IS NOT NULL)::int +
    (pi.file_size_bytes IS NOT NULL)::int +
    (pi.url_original IS NOT NULL OR (pi.source_supplier = 'SPOT' AND it.code IN ('component','location','area')))::int +
    (pi.color_id IS NOT NULL OR pi.applies_to_color IS NOT TRUE)::int +
    (pi.alt_text IS NOT NULL AND length(pi.alt_text) >= 20)::int +
    (pi.image_type = it.code OR pi.image_type IS NULL)::int
  ) / 7.0, 1)                                                                     AS score_completude,
  -- ─── PRIORIDADE DE CORREÇÃO ────────────────────────────────────────────────
  CASE
    WHEN pi.is_active = false                                                    THEN 'I-inativa'
    WHEN pi.is_primary AND (pi.width_px IS NULL OR pi.height_px IS NULL) AND pi.format IS NULL THEN 'P0-primary-multi-gap'
    WHEN pi.is_primary AND (pi.width_px IS NULL OR pi.height_px IS NULL)        THEN 'P0-primary-sem-dim'
    WHEN pi.format IS NULL AND (pi.width_px IS NULL OR pi.height_px IS NULL)    THEN 'P1-sem-format-dim'
    WHEN (pi.width_px IS NULL OR pi.height_px IS NULL)                          THEN 'P2-sem-dimensoes'
    WHEN pi.format IS NULL                                                       THEN 'P3-sem-format'
    WHEN pi.url_original IS NULL
      AND pi.is_active
      AND NOT (pi.source_supplier = 'SPOT' AND it.code IN ('component','location','area')) THEN 'P4-sem-url-original'
    WHEN pi.applies_to_color = true AND pi.color_id IS NULL AND pi.is_active    THEN 'P5-sem-color-id'
    WHEN (pi.alt_text IS NULL OR length(pi.alt_text) < 20)                      THEN 'P6-alt-curto'
    ELSE 'OK'
  END                                                                              AS prioridade_correcao
FROM public.product_images pi
JOIN public.image_types it ON it.id = pi.image_type_id
WITH DATA;

-- ─── ÍNDICES ──────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX uq_mv_product_images_audit_id
  ON public.mv_product_images_audit (id);

CREATE INDEX idx_mv_pia_supplier_prioridade
  ON public.mv_product_images_audit (source_supplier, prioridade_correcao);

CREATE INDEX idx_mv_pia_score
  ON public.mv_product_images_audit (score_completude);

CREATE INDEX idx_mv_pia_gaps_format_dim
  ON public.mv_product_images_audit (gap_format, gap_dimensoes)
  WHERE gap_format OR gap_dimensoes;

CREATE INDEX idx_mv_pia_product_pendente
  ON public.mv_product_images_audit (product_id)
  WHERE prioridade_correcao NOT IN ('I-inativa','OK');

CREATE INDEX idx_mv_pia_prioridade
  ON public.mv_product_images_audit (prioridade_correcao);

-- ─── PERMISSÕES ───────────────────────────────────────────────────────────────
REVOKE ALL ON public.mv_product_images_audit FROM anon, authenticated;
GRANT SELECT ON public.mv_product_images_audit TO service_role;

COMMENT ON MATERIALIZED VIEW public.mv_product_images_audit IS
'Auditoria completa de product_images: 7 dimensões de qualidade, score 0-100, gap flags,
prioridade_correcao. Refresh a cada 6h via pg_cron (job refresh-mv-product-images-audit).
Não exposto a anon/authenticated.';

-- ─── PG_CRON: refresh automático a cada 6h ────────────────────────────────────
SELECT cron.unschedule(jobname)
FROM cron.job WHERE jobname = 'refresh-mv-product-images-audit';

SELECT cron.schedule(
  'refresh-mv-product-images-audit',
  '0 */6 * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_product_images_audit$$
);
