-- Migration: create_health_check_function_20260618
-- Purpose: 15-invariant health check for product_images integrity
-- Function: public.fn_product_images_health_check()
-- Checks: C01–C15 covering CF equivalence, canonical dedup, soft-delete, CDN URLs, sync

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_product_images_health_check()
RETURNS TABLE(check_name text, status text, value bigint, threshold bigint, details text)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  -- C01: All active images verified in CF
  RETURN QUERY SELECT
    'c01_all_active_verified'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Active images not verified in CF'::text
  FROM public.product_images
  WHERE deleted_at IS NULL AND cf_sync_status <> 'verified';

  -- C02: Zero CF orphans (CF has image not in product_images)
  RETURN QUERY SELECT
    'c02_zero_cf_orphans'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'CF images not in product_images'::text
  FROM cf_recon.cf_image c
  WHERE NOT EXISTS (SELECT 1 FROM public.product_images p
    WHERE p.cloudflare_image_id = c.image_id AND p.deleted_at IS NULL);

  -- C03: cf_recon count matches active product_images count (±5 tolerance)
  RETURN QUERY SELECT
    'c03_recon_pi_sync'::text,
    CASE WHEN ABS(c.recon_total - c.pi_total) <= 5 THEN 'OK' ELSE 'WARN' END,
    ABS(c.recon_total - c.pi_total), 5::bigint,
    'Difference between cf_recon.cf_image and active product_images'::text
  FROM (SELECT
    (SELECT COUNT(*) FROM cf_recon.cf_image) AS recon_total,
    (SELECT COUNT(*) FROM public.product_images WHERE deleted_at IS NULL) AS pi_total
  ) c;

  -- C04: No duplicate cloudflare_image_id among active images
  RETURN QUERY SELECT
    'c04_no_duplicate_cf_id'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Duplicate cloudflare_image_id in active images'::text
  FROM (SELECT cloudflare_image_id
    FROM public.product_images WHERE deleted_at IS NULL
    GROUP BY cloudflare_image_id HAVING COUNT(*) > 1) dup;

  -- C05: Soft-deleted images always have a reason
  RETURN QUERY SELECT
    'c05_soft_delete_has_reason'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Soft-deleted images without deleted_reason'::text
  FROM public.product_images
  WHERE deleted_at IS NOT NULL AND (deleted_reason IS NULL OR deleted_reason = '');

  -- C06: No is_active=true on soft-deleted rows
  RETURN QUERY SELECT
    'c06_no_active_deleted'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Active=true but soft-deleted images'::text
  FROM public.product_images
  WHERE deleted_at IS NOT NULL AND is_active = true;

  -- C07: Canonical chains are flat (no A→B→C, only A→B)
  RETURN QUERY SELECT
    'c07_canonical_chains_flat'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Canonical pointing to non-root (chain detected)'::text
  FROM public.product_images pi_child
  JOIN public.product_images pi_root ON pi_root.id = pi_child.canonical_image_id
  WHERE pi_child.canonical_image_id IS NOT NULL AND pi_root.canonical_image_id IS NOT NULL;

  -- C08: No canonical cycles (A→B, B→A)
  RETURN QUERY SELECT
    'c08_no_canonical_cycles'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Canonical cycles detected (A→B, B→A)'::text
  FROM public.product_images a
  JOIN public.product_images b ON b.id = a.canonical_image_id AND b.canonical_image_id = a.id;

  -- C09: is_shared=true always has canonical_image_id
  RETURN QUERY SELECT
    'c09_shared_has_canonical'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'is_shared=true without canonical_image_id'::text
  FROM public.product_images
  WHERE deleted_at IS NULL AND is_shared = true AND canonical_image_id IS NULL;

  -- C10: All active images have valid CDN URLs
  RETURN QUERY SELECT
    'c10_valid_cdn_urls'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Active images with invalid url_cdn'::text
  FROM public.product_images
  WHERE deleted_at IS NULL AND (url_cdn IS NULL OR url_cdn NOT LIKE 'https://imagedelivery.net/%');

  -- C11: No NULL format on active images
  RETURN QUERY SELECT
    'c11_no_null_format'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Active images with NULL format'::text
  FROM public.product_images WHERE deleted_at IS NULL AND format IS NULL;

  -- C12: Alt-text coverage (all active images have meaningful alt text ≥10 chars)
  RETURN QUERY SELECT
    'c12_alt_text_coverage'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Active images with missing/short alt_text'::text
  FROM public.product_images
  WHERE deleted_at IS NULL AND (alt_text IS NULL OR LENGTH(alt_text) < 10);

  -- C13: Canonical pointers do not target soft-deleted images
  RETURN QUERY SELECT
    'c13_canonical_not_deleted'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Canonical pointing to soft-deleted image'::text
  FROM public.product_images pi
  WHERE pi.canonical_image_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.product_images root
      WHERE root.id = pi.canonical_image_id AND root.deleted_at IS NOT NULL);

  -- C14: No NULL display_order on active images
  RETURN QUERY SELECT
    'c14_display_order_not_null'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Active images with NULL display_order'::text
  FROM public.product_images WHERE deleted_at IS NULL AND display_order IS NULL;

  -- C15: products.primary_image_url in sync with product_images (±5 tolerance)
  RETURN QUERY SELECT
    'c15_primary_image_url_sync'::text,
    CASE WHEN COUNT(*) <= 5 THEN 'OK' ELSE 'WARN' END,
    COUNT(*), 5::bigint,
    'Products where primary_image_url diverges from product_images primary'::text
  FROM public.products p
  JOIN public.product_images pi ON pi.product_id = p.id
    AND pi.is_primary = true AND pi.is_active = true AND pi.deleted_at IS NULL
  WHERE p.is_active = true AND (p.is_deleted IS NULL OR p.is_deleted = false)
    AND p.primary_image_url IS NOT NULL AND p.primary_image_url <> pi.url_cdn;

END;
$$;

REVOKE ALL ON FUNCTION public.fn_product_images_health_check() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_product_images_health_check() TO service_role;

COMMIT;
