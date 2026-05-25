-- =============================================================================
-- Migration: criar índices em foreign keys não indexadas
-- =============================================================================
-- Bug P1-09 da auditoria 24/05/2026.
--
-- Causa-raiz: FKs sem índice forçam Postgres a fazer SEQ SCAN em DELETE/UPDATE
-- da tabela pai (verificar existência de child rows). Em tabelas grandes
-- (collection_products, product_kit_components, product_variants), isso pode
-- causar lock-contention e timeouts em operações administrativas.
--
-- A auditoria do advisor Supabase listava 2 FKs (as mais visíveis), mas query
-- direta em pg_constraint × pg_index revelou 9 FKs sem índice. Todas listadas
-- abaixo. Uso `IF NOT EXISTS` para idempotência.
--
-- Trade-off: cada índice consome disco + I/O em INSERT/UPDATE. Para FKs, o
-- ganho em SELECT/DELETE/UPDATE (lookup O(log n)) supera o custo em quase
-- todos os casos práticos.
-- =============================================================================

-- 1. collection_products.product_id (FK collection_products_product_id_fkey1)
CREATE INDEX IF NOT EXISTS idx_collection_products_product_id
  ON public.collection_products (product_id);

-- 2-3. product_commemorative_dates: category_id + commemorative_date_id
CREATE INDEX IF NOT EXISTS idx_product_commemorative_dates_category_id
  ON public.product_commemorative_dates (category_id);

CREATE INDEX IF NOT EXISTS idx_product_commemorative_dates_date_id
  ON public.product_commemorative_dates (commemorative_date_id);

-- 4. product_kit_components.component_product_id
CREATE INDEX IF NOT EXISTS idx_product_kit_components_component_product_id
  ON public.product_kit_components (component_product_id);

-- 5. product_relationships.related_product_id
CREATE INDEX IF NOT EXISTS idx_product_relationships_related_product_id
  ON public.product_relationships (related_product_id);

-- 6. product_variants.size_id
CREATE INDEX IF NOT EXISTS idx_product_variants_size_id
  ON public.product_variants (size_id);

-- 7. supplier_import_batches.supplier_id
CREATE INDEX IF NOT EXISTS idx_supplier_import_batches_supplier_id
  ON public.supplier_import_batches (supplier_id);

-- 8. variant_supplier_sources.supplier_id (FK ainda nomeado variant_stocks_*)
CREATE INDEX IF NOT EXISTS idx_variant_supplier_sources_supplier_id
  ON public.variant_supplier_sources (supplier_id);

-- 9. variant_supplier_sources.supplier_branch_id
CREATE INDEX IF NOT EXISTS idx_variant_supplier_sources_supplier_branch_id
  ON public.variant_supplier_sources (supplier_branch_id);

-- =============================================================================
-- Validação:
--   SELECT count(*) FROM (... query do audit ...) → 0 FKs sem índice
-- =============================================================================
