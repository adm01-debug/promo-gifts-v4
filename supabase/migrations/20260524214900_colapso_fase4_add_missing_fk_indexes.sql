-- =============================================================
-- 11 FOREIGN KEYS SEM ÍNDICE — perf advisor identificou
--
-- Cada FK sem índice força full scan na tabela referida toda vez que
-- a tabela pai é alterada/deletada. Adicionar índices é zero-risco e
-- acelera DELETE/UPDATE em cascata e JOINs.
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_collection_products_product_id_fk
  ON public.collection_products (product_id);

CREATE INDEX IF NOT EXISTS idx_frontend_telemetry_user_id
  ON public.frontend_telemetry (user_id);

CREATE INDEX IF NOT EXISTS idx_product_commemorative_dates_category_id_fk
  ON public.product_commemorative_dates (category_id);

CREATE INDEX IF NOT EXISTS idx_product_commemorative_dates_commemorative_date_id
  ON public.product_commemorative_dates (commemorative_date_id);

CREATE INDEX IF NOT EXISTS idx_product_kit_components_component_product_id
  ON public.product_kit_components (component_product_id);

CREATE INDEX IF NOT EXISTS idx_product_kit_components_secondary_material_type_id
  ON public.product_kit_components (secondary_material_type_id);

CREATE INDEX IF NOT EXISTS idx_product_relationships_related_product_id
  ON public.product_relationships (related_product_id);

CREATE INDEX IF NOT EXISTS idx_product_variants_size_id
  ON public.product_variants (size_id);

CREATE INDEX IF NOT EXISTS idx_supplier_import_batches_supplier_id
  ON public.supplier_import_batches (supplier_id);

CREATE INDEX IF NOT EXISTS idx_variant_supplier_sources_supplier_id_fk
  ON public.variant_supplier_sources (supplier_id);

CREATE INDEX IF NOT EXISTS idx_variant_supplier_sources_supplier_branch_id
  ON public.variant_supplier_sources (supplier_branch_id);
