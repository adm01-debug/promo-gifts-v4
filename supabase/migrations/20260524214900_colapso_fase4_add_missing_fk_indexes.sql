-- Additional indexes for foreign-key columns reported by the performance advisor.
-- Replay-safe: clean schemas can omit some legacy tables or columns.

DO $$
DECLARE
  v_index record;
BEGIN
  FOR v_index IN
    SELECT *
    FROM (
      VALUES
        ('idx_collection_products_product_id_fk', 'collection_products', 'product_id'),
        ('idx_frontend_telemetry_user_id', 'frontend_telemetry', 'user_id'),
        ('idx_product_commemorative_dates_category_id_fk', 'product_commemorative_dates', 'category_id'),
        ('idx_product_commemorative_dates_commemorative_date_id', 'product_commemorative_dates', 'commemorative_date_id'),
        ('idx_product_kit_components_component_product_id', 'product_kit_components', 'component_product_id'),
        ('idx_product_kit_components_secondary_material_type_id', 'product_kit_components', 'secondary_material_type_id'),
        ('idx_product_relationships_related_product_id', 'product_relationships', 'related_product_id'),
        ('idx_product_variants_size_id', 'product_variants', 'size_id'),
        ('idx_supplier_import_batches_supplier_id', 'supplier_import_batches', 'supplier_id'),
        ('idx_variant_supplier_sources_supplier_id_fk', 'variant_supplier_sources', 'supplier_id'),
        ('idx_variant_supplier_sources_supplier_branch_id', 'variant_supplier_sources', 'supplier_branch_id')
    ) AS indexes(index_name, table_name, column_name)
  LOOP
    IF to_regclass(format('public.%I', v_index.table_name)) IS NULL THEN
      RAISE NOTICE '[colapso_fase4_add_missing_fk_indexes] Skipped %.%: table does not exist',
        v_index.table_name,
        v_index.column_name;
    ELSIF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = v_index.table_name
        AND column_name = v_index.column_name
    ) THEN
      RAISE NOTICE '[colapso_fase4_add_missing_fk_indexes] Skipped %.%: column does not exist',
        v_index.table_name,
        v_index.column_name;
    ELSE
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (%I)',
        v_index.index_name,
        v_index.table_name,
        v_index.column_name
      );
    END IF;
  END LOOP;
END $$;
