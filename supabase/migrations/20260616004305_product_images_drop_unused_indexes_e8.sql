-- ============================================================================
-- E8: Drop de 3 índices não utilizados / redundantes em product_images
-- Economia: ~3.2 MB de storage + menor overhead em INSERT/UPDATE/DELETE.
-- ----------------------------------------------------------------------------
-- idx_product_images_og:              0 scans — nenhum query filtra is_og_image
-- idx_product_images_organization_id: 44 scans — single-tenant, cardinalidade ~1
-- idx_product_images_type:            67 scans — coberto por
--   idx_product_images_product_type_active (product_id, image_type, display_order
--   WHERE is_active=true), que é mais seletivo e usado em hot paths
-- ============================================================================

DROP INDEX IF EXISTS public.idx_product_images_og;
DROP INDEX IF EXISTS public.idx_product_images_organization_id;
DROP INDEX IF EXISTS public.idx_product_images_type;
