-- =====================================================================
-- Performance advisor: drop redundant duplicate indexes.
--
-- Each dropped index was verified (pg_get_indexdef) to be byte-identical to a
-- retained sibling on the same table, non-unique, and backing no constraint.
-- Removing them reduces write amplification and storage with zero read-path
-- impact. Applied to prod via MCP on 2026-05-29; this file keeps the repo
-- history in sync and is idempotent (safe to re-run / db reset).
--
-- Retained / dropped pairs:
--   integration_credentials      keep idx_integration_credentials_provider          drop idx_integration_creds_provider
--   product_commemorative_dates  keep idx_product_commemorative_dates_category_id    drop idx_product_commemorative_dates_category_id_fk
--   product_commemorative_dates  keep idx_product_commemorative_dates_commemorative_date_id  drop idx_product_commemorative_dates_date_id
--   quote_items                  keep idx_quote_items_quote_id                       drop idx_quote_items_quote
--   variant_supplier_sources     keep idx_variant_supplier_sources_supplier_id       drop idx_variant_supplier_sources_supplier_id_fk
-- =====================================================================
DROP INDEX IF EXISTS public.idx_integration_creds_provider;
DROP INDEX IF EXISTS public.idx_product_commemorative_dates_category_id_fk;
DROP INDEX IF EXISTS public.idx_product_commemorative_dates_date_id;
DROP INDEX IF EXISTS public.idx_quote_items_quote;
DROP INDEX IF EXISTS public.idx_variant_supplier_sources_supplier_id_fk;
