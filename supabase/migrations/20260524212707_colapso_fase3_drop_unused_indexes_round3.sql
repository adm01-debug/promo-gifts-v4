-- =============================================================
-- FASE 3 (Round 3) — 9 índices unused em tabelas com 500-5K writes.
-- Total a recuperar: ~1.5 MB.
-- =============================================================

-- product_relationships (1)
DROP INDEX IF EXISTS public.idx_pr_related_product_id;

-- product_variants (3)
DROP INDEX IF EXISTS public.idx_variants_color_code;
DROP INDEX IF EXISTS public.product_variants_size_id_idx;
DROP INDEX IF EXISTS public.product_variants_sku_promo_idx;

-- categories (2)
DROP INDEX IF EXISTS public.idx_categories_path;
DROP INDEX IF EXISTS public.idx_categories_full_path_readable;

-- product_kit_components (3)
DROP INDEX IF EXISTS public.idx_kit_components_supplier;
DROP INDEX IF EXISTS public.idx_kit_components_component;
DROP INDEX IF EXISTS public.idx_kit_components_code;
