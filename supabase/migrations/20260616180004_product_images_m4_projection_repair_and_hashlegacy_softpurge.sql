-- ============================================================================
-- MELHORIA 4 — Reparo defensivo de projecoes + expurgo SOFT hash_legacy
-- Aplicado em prod via MCP em 2026-06-16; este arquivo espelha o estado (condicao corrigida).
--
-- NOTA FORENSE: a simulacao apontou 196 produtos com primary_image_url "apontando p/ hash_legacy",
-- MAS a investigacao mostrou que url_cdn das 519 hash_legacy e CANONICALIZADO p/ imagens validas
-- (hl_urlcdn_self=0, hl_urlcdn_canonicalized=519, truly_broken_primary=0). Logo a projecao NAO
-- estava quebrada — era falso-positivo por compartilhamento de url_cdn. O repoint abaixo usa a
-- condicao CORRETA (primaria que NAO resolve p/ nenhuma imagem ativa) — no-op idempotente hoje,
-- defensivo p/ o futuro. O soft-delete das hash_legacy (inativas, cloudflare_image_id 100% ausente
-- no CF) permanece como limpeza de governanca (reversivel via deleted_at).
-- https://claude.ai/code/session_01JWqwBkgRNk8v6ejLd18Hv9
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS backup;
CREATE TABLE IF NOT EXISTS backup.products_imageproj_20260616 AS
  SELECT id, primary_image_url, og_image_url, primary_image_fallback_url, now() AS snapshot_at
  FROM public.products
  WHERE primary_image_url IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.product_images v
                     WHERE v.url_cdn = products.primary_image_url AND v.is_active);

SET LOCAL session_replication_role = replica;

-- M4a: repoint primary_image_url SOMENTE quando nao resolve p/ nenhuma imagem ativa -> primaria ativa
WITH ap AS (
  SELECT DISTINCT ON (product_id) product_id, url_cdn
  FROM public.product_images WHERE is_active AND is_primary
  ORDER BY product_id, display_order
)
UPDATE public.products p
   SET primary_image_url = ap.url_cdn, updated_at = now()
  FROM ap
 WHERE p.id = ap.product_id
   AND p.primary_image_url IS DISTINCT FROM ap.url_cdn
   AND NOT EXISTS (SELECT 1 FROM public.product_images v
                    WHERE v.url_cdn = p.primary_image_url AND v.is_active);

-- M4a': mesma logica p/ og_image_url
WITH ap AS (
  SELECT DISTINCT ON (product_id) product_id, url_cdn
  FROM public.product_images WHERE is_active AND is_primary
  ORDER BY product_id, display_order
)
UPDATE public.products p
   SET og_image_url = ap.url_cdn, updated_at = now()
  FROM ap
 WHERE p.id = ap.product_id
   AND p.og_image_url IS DISTINCT FROM ap.url_cdn
   AND NOT EXISTS (SELECT 1 FROM public.product_images v
                    WHERE v.url_cdn = p.og_image_url AND v.is_active);

-- M4b: expurgo SOFT das hash_legacy (inativas, cloudflare_image_id 100% ausente no CF) — reversivel
UPDATE public.product_images
   SET deleted_at = now(),
       deleted_reason = 'hash_legacy xbz_site_* 100% ausente no Cloudflare (auditoria 2026-06-16); inativa, sem impacto UX',
       last_modified_source = 'claude'
 WHERE cf_id_scheme = 'hash_legacy'
   AND deleted_at IS NULL;

SET LOCAL session_replication_role = origin;
