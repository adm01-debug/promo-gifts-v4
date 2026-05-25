-- =============================================================
-- FASE 3 (Round 2) — Drop dos 11 índices unused remanescentes
-- em tabelas com >5K writes/histórico. Critério idêntico ao round 1.
-- Total a recuperar: ~928 kB.
-- =============================================================

-- product_commemorative_dates (4)
DROP INDEX IF EXISTS public.idx_prod_comm_active;
DROP INDEX IF EXISTS public.idx_product_commemorative_dates_category_id;
DROP INDEX IF EXISTS public.idx_prod_comm_date;
DROP INDEX IF EXISTS public.idx_prod_comm_featured;

-- products (5 — preservados idx_products_slug_unique e ux_products_external_id_not_null)
DROP INDEX IF EXISTS public.idx_products_bitrix_images_synced_at;
DROP INDEX IF EXISTS public.idx_products_packing_classification;
DROP INDEX IF EXISTS public.idx_products_ai_version;
DROP INDEX IF EXISTS public.products_gtin_idx;
DROP INDEX IF EXISTS public.products_ean_idx;

-- suppliers (1)
DROP INDEX IF EXISTS public.idx_suppliers_sync_enabled;

-- variant_supplier_sources (1)
DROP INDEX IF EXISTS public.idx_vss_removed;
