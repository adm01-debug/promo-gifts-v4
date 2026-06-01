-- =============================================================
-- FASE 3 — Drop seletivo de 27 índices não usados (idx_scan=0)
-- em tabelas com alta taxa de writes.
--
-- Critério aplicado:
--   - idx_scan = 0 (PostgreSQL nunca usou no plano)
--   - Tabela com >5K writes no histórico de stats
--   - NÃO é PRIMARY KEY (preservado: admin_audit_log_pkey)
--   - NÃO é UNIQUE CONSTRAINT (preservado: variant_stocks_*_key)
--   - NÃO é UNIQUE INDEX que garante invariante de negócio
--     (preservados: idx_products_slug_unique, variant_stocks_unique_idx)
-- =============================================================

-- products (18 índices)
DROP INDEX IF EXISTS public.idx_products_slug_active;
DROP INDEX IF EXISTS public.idx_products_supplier_product_url;
DROP INDEX IF EXISTS public.idx_products_supplier_ref;
DROP INDEX IF EXISTS public.idx_products_bitrix_id;
DROP INDEX IF EXISTS public.idx_products_description_packaging;
DROP INDEX IF EXISTS public.idx_products_last_sync;
DROP INDEX IF EXISTS public.products_ncm_code_idx;
DROP INDEX IF EXISTS public.idx_products_is_stockout;
DROP INDEX IF EXISTS public.idx_products_is_textil;
DROP INDEX IF EXISTS public.idx_products_product_type;
DROP INDEX IF EXISTS public.idx_products_shape_type;
DROP INDEX IF EXISTS public.idx_products_capacity_ml;
DROP INDEX IF EXISTS public.idx_products_sync_status;
DROP INDEX IF EXISTS public.idx_products_gender;
DROP INDEX IF EXISTS public.products_sku_promo_idx;
DROP INDEX IF EXISTS public.products_is_deleted_idx;
DROP INDEX IF EXISTS public.idx_products_supply_mode;
DROP INDEX IF EXISTS public.idx_products_auto_cat;
DROP INDEX IF EXISTS public.idx_products_ai_pending;

-- variant_supplier_sources (5 índices — preservados os 2 UNIQUE)
DROP INDEX IF EXISTS public.idx_vss_supplier_sku;
DROP INDEX IF EXISTS public.idx_vss_with_stock;
DROP INDEX IF EXISTS public.idx_vss_sync_status;
DROP INDEX IF EXISTS public.variant_stocks_supplier_id_idx;
DROP INDEX IF EXISTS public.idx_vss_supplier_branch;

-- supplier_import_batches (1 índice)
DROP INDEX IF EXISTS public.idx_supplier_import_batches_supplier_status;

-- product_commemorative_dates (1 índice)
DROP INDEX IF EXISTS public.idx_prod_comm_source;
