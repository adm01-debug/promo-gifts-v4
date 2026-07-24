-- Melhoria 8: DROP 12 índices mortos (0 scans desde criação, 0 referências no código)
DROP INDEX IF EXISTS public.idx_products_supplier_stock_name;
DROP INDEX IF EXISTS public.idx_products_tags_gin;
DROP INDEX IF EXISTS public.idx_products_is_active_supplier_name;
DROP INDEX IF EXISTS public.idx_products_is_active_category_name;
DROP INDEX IF EXISTS public.idx_products_active_cost_stock;
DROP INDEX IF EXISTS public.idx_products_novelties_covering;
DROP INDEX IF EXISTS public.idx_products_is_active_created_at;
DROP INDEX IF EXISTS public.idx_products_seo_listing;
DROP INDEX IF EXISTS public.products_brand_idx;
DROP INDEX IF EXISTS public.idx_products_auto_mat;
DROP INDEX IF EXISTS public.idx_products_engraving_type;
DROP INDEX IF EXISTS public.idx_products_allows_personalization;