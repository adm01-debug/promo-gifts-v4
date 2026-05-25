-- =============================================================
-- FASE 3 (Round 4) — Drop dos 5 índices unused remanescentes hot.
-- =============================================================

DROP INDEX IF EXISTS public.idx_supplier_import_batches_supplier_id;
DROP INDEX IF EXISTS public.idx_product_commemorative_dates_category_id;
DROP INDEX IF EXISTS public.idx_product_commemorative_dates_date_id;
DROP INDEX IF EXISTS public.idx_variant_supplier_sources_supplier_branch_id;
DROP INDEX IF EXISTS public.idx_variant_supplier_sources_supplier_id;
