-- =============================================================
-- DROP DOS ÍNDICES NÃO USADOS RESTANTES (fase 4)
--
-- Critério: idx_scan = 0 + tabela com writes frequentes + NÃO PK/UNIQUE
-- Ganho: ~1MB de espaço + UPDATEs ainda mais rápidos
-- =============================================================

-- product_commemorative_dates (232kB cada — total ~700KB)
DROP INDEX IF EXISTS public.idx_prod_comm_active;
DROP INDEX IF EXISTS public.idx_product_commemorative_dates_category_id;
DROP INDEX IF EXISTS public.idx_prod_comm_date;
DROP INDEX IF EXISTS public.idx_prod_comm_featured;

-- products (resto que sobrou)
DROP INDEX IF EXISTS public.idx_products_bitrix_images_synced_at;
DROP INDEX IF EXISTS public.idx_products_packing_classification;
DROP INDEX IF EXISTS public.idx_products_ai_version;
DROP INDEX IF EXISTS public.products_gtin_idx;
DROP INDEX IF EXISTS public.products_ean_idx;

-- suppliers
DROP INDEX IF EXISTS public.idx_suppliers_sync_enabled;

-- variant_supplier_sources
DROP INDEX IF EXISTS public.idx_vss_removed;

-- Reporta tamanho liberado
SELECT
  count(*) AS indices_droppados_total,
  pg_size_pretty(sum(pg_relation_size(c.oid))) AS espaco_total_indices_remanescentes
FROM pg_stat_user_indexes ui
JOIN pg_class c ON c.oid = ui.indexrelid
WHERE ui.schemaname = 'public';
