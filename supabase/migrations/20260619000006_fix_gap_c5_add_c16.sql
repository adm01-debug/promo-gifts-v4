-- Migration: fix_gap_c5_add_c16_20260619
-- Purpose: Close GAP-C5 and add C16 health-check invariant.
--
--   GAP-C5: When a ROOT's content_hash changes and fn_autolink re-assigns it as a
--           dependent of a new root, any rows that previously pointed to that old root
--           still do so — creating dep→dep chains (C07 violation).
--           Fix: AFTER trigger on UPDATE OF canonical_image_id; fires when a row
--           transitions from root (NULL canonical) to dep (non-NULL canonical).
--           Re-links all former deps to the new root.
--
--   C16:    New health-check invariant: deps whose content_hash does not match their
--           canonical's content_hash (cross-group canonical). This catches GAP-C6
--           residual violations and any future manual mis-assignments.

BEGIN;

-- ══════════════════════════════════════════════════════════════════════
-- FIX GAP-C5: Re-link former deps when a root becomes a dep
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_relink_former_deps_on_root_becomes_dep()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Only act when this row WAS a root and NOW became a dep.
  -- OLD.canonical_image_id IS NULL  → was root
  -- NEW.canonical_image_id IS NOT NULL → now dep
  IF OLD.canonical_image_id IS NOT NULL OR NEW.canonical_image_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Re-link all live rows that still point to this (now non-root) row.
  -- Point them directly to the new root to restore flat chains.
  UPDATE public.product_images
  SET canonical_image_id = NEW.canonical_image_id,
      updated_at          = now()
  WHERE canonical_image_id = NEW.id
    AND id <> NEW.id
    AND deleted_at IS NULL;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_relink_former_deps_on_root_becomes_dep() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_relink_former_deps_on_root_becomes_dep() TO service_role;

DROP TRIGGER IF EXISTS trg_relink_former_deps_on_root_becomes_dep ON public.product_images;
CREATE TRIGGER trg_relink_former_deps_on_root_becomes_dep
  AFTER UPDATE OF canonical_image_id
  ON public.product_images
  FOR EACH ROW
  WHEN (OLD.canonical_image_id IS NULL AND NEW.canonical_image_id IS NOT NULL)
  EXECUTE FUNCTION public.fn_relink_former_deps_on_root_becomes_dep();

-- ══════════════════════════════════════════════════════════════════════
-- C16: New health-check invariant — cross-group canonical detection
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_product_images_health_check()
RETURNS TABLE(check_name text, status text, value bigint, threshold bigint, details text)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = pg_catalog, public
AS $function$
BEGIN
  -- C01: Todas as imagens ativas são verified no CF
  RETURN QUERY SELECT
    'c01_all_active_verified'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Active images not verified in CF'::text
  FROM public.product_images
  WHERE deleted_at IS NULL AND cf_sync_status <> 'verified';

  -- C02: Zero orphans no CF (CF tem imagem sem produto)
  RETURN QUERY SELECT
    'c02_zero_cf_orphans'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'CF images not in product_images'::text
  FROM cf_recon.cf_image c
  WHERE NOT EXISTS (SELECT 1 FROM public.product_images p
    WHERE p.cloudflare_image_id = c.image_id AND p.deleted_at IS NULL);

  -- C03: Recon = product_images ativas
  RETURN QUERY SELECT
    'c03_recon_pi_sync'::text,
    CASE WHEN ABS(c.recon_total - c.pi_total) = 0 THEN 'OK' ELSE 'WARN' END,
    ABS(c.recon_total - c.pi_total), 5::bigint,
    'Difference between cf_recon.cf_image and active product_images'::text
  FROM (SELECT
    (SELECT COUNT(*) FROM cf_recon.cf_image) AS recon_total,
    (SELECT COUNT(*) FROM public.product_images WHERE deleted_at IS NULL) AS pi_total
  ) c;

  -- C04: Sem cloudflare_image_id duplicados
  RETURN QUERY SELECT
    'c04_no_duplicate_cf_id'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Duplicate cloudflare_image_id in active images'::text
  FROM (SELECT cloudflare_image_id
    FROM public.product_images WHERE deleted_at IS NULL
    GROUP BY cloudflare_image_id HAVING COUNT(*) > 1) dup;

  -- C05: Soft-delete sempre tem razão
  RETURN QUERY SELECT
    'c05_soft_delete_has_reason'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Soft-deleted images without deleted_reason'::text
  FROM public.product_images
  WHERE deleted_at IS NOT NULL AND (deleted_reason IS NULL OR deleted_reason = '');

  -- C06: Sem is_active=true em deletadas
  RETURN QUERY SELECT
    'c06_no_active_deleted'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Active=true but soft-deleted images'::text
  FROM public.product_images
  WHERE deleted_at IS NOT NULL AND is_active = true;

  -- C07: Cadeias canônicas flat (sem encadeamento)
  RETURN QUERY SELECT
    'c07_canonical_chains_flat'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Canonical pointing to non-root (chain detected)'::text
  FROM public.product_images pi_child
  JOIN public.product_images pi_root ON pi_root.id = pi_child.canonical_image_id
  WHERE pi_child.canonical_image_id IS NOT NULL AND pi_root.canonical_image_id IS NOT NULL;

  -- C08: Sem ciclos canônicos
  RETURN QUERY SELECT
    'c08_no_canonical_cycles'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Canonical cycles detected (A→B, B→A)'::text
  FROM public.product_images a
  JOIN public.product_images b ON b.id = a.canonical_image_id AND b.canonical_image_id = a.id;

  -- C09: is_shared consistência
  RETURN QUERY SELECT
    'c09_shared_has_canonical'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'is_shared=true without canonical_image_id'::text
  FROM public.product_images
  WHERE deleted_at IS NULL AND is_shared = true AND canonical_image_id IS NULL;

  -- C10: URL CDN válida
  RETURN QUERY SELECT
    'c10_valid_cdn_urls'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Active images with invalid url_cdn'::text
  FROM public.product_images
  WHERE deleted_at IS NULL AND (url_cdn IS NULL OR url_cdn NOT LIKE 'https://imagedelivery.net/%');

  -- C11: Format válido (sem null)
  RETURN QUERY SELECT
    'c11_no_null_format'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Active images with NULL format'::text
  FROM public.product_images WHERE deleted_at IS NULL AND format IS NULL;

  -- C12: Alt-text cobertura (≥10 chars)
  RETURN QUERY SELECT
    'c12_alt_text_coverage'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Active images with missing/short alt_text'::text
  FROM public.product_images
  WHERE deleted_at IS NULL AND (alt_text IS NULL OR LENGTH(alt_text) < 10);

  -- C13: Canonical não aponta para imagem deletada
  RETURN QUERY SELECT
    'c13_canonical_not_deleted'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Canonical pointing to soft-deleted image'::text
  FROM public.product_images pi
  WHERE pi.canonical_image_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.product_images root
      WHERE root.id = pi.canonical_image_id AND root.deleted_at IS NOT NULL);

  -- C14: Display_order sem nulos
  RETURN QUERY SELECT
    'c14_display_order_not_null'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Active images with NULL display_order'::text
  FROM public.product_images WHERE deleted_at IS NULL AND display_order IS NULL;

  -- C15: products.primary_image_url em sync
  RETURN QUERY SELECT
    'c15_primary_image_url_sync'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARN' END,
    COUNT(*), 5::bigint,
    'Products where primary_image_url diverges from product_images primary'::text
  FROM public.products p
  JOIN public.product_images pi ON pi.product_id = p.id
    AND pi.is_primary = true AND pi.is_active = true AND pi.deleted_at IS NULL
  WHERE p.is_active = true AND (p.is_deleted IS NULL OR p.is_deleted = false)
    AND p.primary_image_url IS NOT NULL AND p.primary_image_url <> pi.url_cdn;

  -- C16: Deps whose content_hash does not match their canonical's content_hash (cross-group)
  -- Catches GAP-C6 residual violations and manual mis-assignments
  RETURN QUERY SELECT
    'c16_canonical_hash_group_consistent'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'FAIL' END,
    COUNT(*), 0::bigint,
    'Deps with content_hash mismatching their canonical group hash'::text
  FROM public.product_images dep
  JOIN public.product_images canon ON canon.id = dep.canonical_image_id
  WHERE dep.deleted_at IS NULL
    AND dep.canonical_image_id IS NOT NULL
    AND dep.content_hash IS NOT NULL
    AND canon.content_hash IS NOT NULL
    AND dep.content_hash <> canon.content_hash;

END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_product_images_health_check() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_product_images_health_check() TO service_role;

COMMIT;
