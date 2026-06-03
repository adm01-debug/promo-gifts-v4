-- ============================================================
-- MIGRATION 004: Remove indices NUNCA utilizados (conservador)
-- Auditoria: 02/06/2026 — Claude Sonnet 4
-- Total com idx_scan=0: 142 indices
-- Esta migration remove apenas os mais pesados e claramente redundantes
-- ATENCAO: Execute VACUUM ANALYZE nas tabelas apos remover!
-- ============================================================

-- product_images: 4MB — indice unico de filename jamais usado
DROP INDEX CONCURRENTLY IF EXISTS public.idx_unique_product_filename;

-- variant_supplier_sources: 1.1MB — indice composto nunca usado
DROP INDEX CONCURRENTLY IF EXISTS public.variant_stocks_organization_id_variant_id_supplier_id_key;

-- product_materials: 1MB — indice composto nunca usado
DROP INDEX CONCURRENTLY IF EXISTS public.product_materials_organization_id_product_id_material_id_pa_key;

-- supplier_import_batches: 400KB
DROP INDEX CONCURRENTLY IF EXISTS public.idx_supplier_import_batches_supplier_id;

-- product_images: 336KB — organization_id nunca consultado em product_images
DROP INDEX CONCURRENTLY IF EXISTS public.idx_product_images_organization_id;

-- frontend_telemetry: 232KB — user_id=NULL em 100% dos registros, indice inutil
DROP INDEX CONCURRENTLY IF EXISTS public.idx_frontend_telemetry_user_id;

-- product_commemorative_dates: 232KB
DROP INDEX CONCURRENTLY IF EXISTS public.idx_product_commemorative_dates_commemorative_date_id;

-- ai_description_queue: 64KB
DROP INDEX CONCURRENTLY IF EXISTS public.idx_ai_description_queue_organization_id;

-- -------------------------------------------------------
-- INDICES COMENTADOS (revisar antes de remover):
-- product_images_cloudflare_image_id_key (2.4MB) — UNIQUE constraint
-- variant_stocks_unique_idx (816KB) — UNIQUE constraint
-- idx_products_slug_unique (712KB) — slug e campo critico SEO
-- idx_product_images_image_type_id (336KB) — FK usada em JOINs
-- idx_supplier_products_raw_import_batch_id (136KB) — usado em sync
-- -------------------------------------------------------
