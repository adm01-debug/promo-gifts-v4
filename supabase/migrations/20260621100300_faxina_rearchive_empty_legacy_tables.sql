-- FAXINA: archive/re-archive tables that are correctly obsolete.

-- product_specifications: 0 rows, no app code refs.
-- calculate_seo_score correctly references archive.product_specifications.
-- Was erroneously restored to public by earlier faxina rollback.
ALTER TABLE public.product_specifications SET SCHEMA archive;

-- supplier_products_raw_history_legacy: 3.18M rows of legacy data, no new writes.
-- fn_purge_spr_history auto-drops it from archive when all captured_at < cutoff.
-- Was erroneously restored to public by earlier faxina rollback.
ALTER TABLE public.supplier_products_raw_history_legacy SET SCHEMA archive;
