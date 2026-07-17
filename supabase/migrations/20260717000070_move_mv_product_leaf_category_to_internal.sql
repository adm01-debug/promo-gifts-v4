-- Migration 070: Move mv_product_leaf_category out of public schema
--
-- Source: 200-commit audit — post-069 security advisor
-- Findings addressed: materialized_view_in_api (1 → 0)
--
-- ─── Root Cause ──────────────────────────────────────────────────────────────
--
-- public.mv_product_leaf_category is flagged by the advisor because:
--   • Materialized views cannot have row-level security
--   • Any role with SELECT can read ALL rows without RLS filtering
--   • It is in the PostgREST-exposed 'public' schema
--
-- The data (product → leaf category mapping) is catalog reference data that
-- ALL authenticated users legitimately see in full. The security concern is
-- about principle of least exposure, not data sensitivity.
--
-- ─── Strategy ────────────────────────────────────────────────────────────────
--
-- 1. Create schema 'internal' (not in PostgREST's exposed schemas)
-- 2. Create internal.mv_product_leaf_category with same definition + indexes
-- 3. Grant authenticated SELECT on internal.mv_product_leaf_category
--    (required because v_products_public has security_invoker=true — it runs
--    with the caller's permissions, so the caller needs access to the MV)
-- 4. Recreate public.v_products_public referencing internal schema
-- 5. Drop public.mv_product_leaf_category
--
-- PostgREST only auto-exposes the 'public' schema by default.
-- The 'internal' schema is NOT in the API, so the MV is hidden from clients.
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
-- CREATE SCHEMA IF NOT EXISTS → no-op if exists
-- CREATE MATERIALIZED VIEW IF NOT EXISTS → no-op if exists
-- CREATE INDEX IF NOT EXISTS → no-op if exists
-- CREATE OR REPLACE VIEW → always replaces (safe — same columns)
-- DROP MATERIALIZED VIEW IF EXISTS → no-op if already dropped

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 1: Create internal schema
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS internal;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2: Create MV in internal schema (same definition as public one)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS internal.mv_product_leaf_category AS
 SELECT DISTINCT ON (pca.product_id) pca.product_id,
    c.id AS leaf_category_id,
    c.name AS leaf_category_name,
    c.level AS leaf_category_level,
    c.parent_id AS leaf_category_parent_id,
    c.slug AS leaf_category_slug,
        CASE
            WHEN p.main_category_id IS NULL THEN c.id
            WHEN c.id = p.main_category_id THEN c.id
            WHEN (EXISTS ( SELECT 1
               FROM category_ancestors ca
              WHERE ca.descendant_id = c.id AND ca.ancestor_id = p.main_category_id)) THEN c.id
            ELSE NULL::uuid
        END AS leaf_category_id_safe
   FROM product_category_assignments pca
     JOIN categories c ON c.id = pca.category_id
     LEFT JOIN products p ON p.id = pca.product_id
  ORDER BY pca.product_id, c.level DESC NULLS LAST, pca.is_primary DESC NULLS LAST, pca.display_order, c.name;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 3: Recreate indexes on internal MV
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_product_leaf_category_product_id
  ON internal.mv_product_leaf_category USING btree (product_id)
  INCLUDE (leaf_category_id, leaf_category_name, leaf_category_level, leaf_category_slug, leaf_category_id_safe);

CREATE INDEX IF NOT EXISTS idx_mv_product_leaf_category_leaf_id
  ON internal.mv_product_leaf_category USING btree (leaf_category_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 4: Grant access to internal MV
-- (authenticated needs SELECT because v_products_public has security_invoker=true)
-- ═══════════════════════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA internal TO authenticated;
GRANT SELECT ON internal.mv_product_leaf_category TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 5: Recreate v_products_public pointing to internal.mv_product_leaf_category
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.v_products_public
  WITH (security_invoker = true)
AS
 SELECT p.id,
    p.name,
    p.description,
    p.sku,
    p.category_id,
    p.supplier_id,
    NULL::numeric AS cost_price,
    p.sale_price,
    p.stock_quantity,
    p.is_active AS active,
    p.created_at,
    p.updated_at,
    NULL::numeric AS suggested_price,
        CASE
            WHEN p.length_cm IS NOT NULL OR p.width_cm IS NOT NULL OR p.height_cm IS NOT NULL OR p.weight_g IS NOT NULL OR p.diameter_cm IS NOT NULL OR p.shape_type IS NOT NULL THEN jsonb_build_object('length_cm', p.length_cm, 'width_cm', p.width_cm, 'height_cm', p.height_cm, 'weight_g', p.weight_g, 'diameter_cm', p.diameter_cm, 'shape_type', p.shape_type, 'unit_detected', p.dimensions_source)
            ELSE NULL::jsonb
        END AS dimensions,
    p.images,
    p.primary_image_url,
    p.videos,
    p.allows_personalization,
    p.colors,
    p.materials,
    p.tags,
    p.meta_title,
    p.meta_description,
    p.meta_keywords,
    p.is_featured,
    p.is_new,
    p.is_on_sale,
    p.view_count,
    p.favorite_count,
    p.order_count,
    NULL::uuid AS organization_id,
    p.product_type,
    p.is_active,
    NULL::uuid AS created_by,
    NULL::uuid AS updated_by,
    p.sku_promo,
    p.short_description,
    p.main_category_id,
    p.brand,
    p.is_deleted,
    p.deleted_at,
    p.is_kit,
    p.is_bestseller,
    p.min_quantity,
    p.box_length_mm,
    p.box_width_mm,
    p.box_height_mm,
    p.box_weight_kg,
    p.has_colors,
    p.has_sizes,
    p.ean,
    p.gtin,
    p.ncm_code,
    p.origin_country,
    p.warranty_months,
    NULL::character varying(100) AS manufacturer_sku,
    p.last_stock_update_at,
    p.supplier_reference,
    p.is_textil,
    p.has_capacity,
    p.combined_sizes,
    p.gender,
    p.is_stockout,
    NULL::boolean AS is_online_exclusive,
    NULL::integer AS catalog_page,
    p.weight_g,
    p.length_cm,
    p.width_cm,
    p.height_cm,
    p.dimensions_display,
    p.box_length_cm,
    p.box_width_cm,
    p.box_height_cm,
    p.box_volume_cm3,
    p.box_quantity,
    p.box_inner_quantity,
    p.packing_type,
    p.repacking_type,
    p.capacities,
    NULL::timestamp with time zone AS last_sync_at,
    NULL::uuid AS last_sync_supplier_id,
    NULL::character varying AS sync_status,
    p.diameter_cm,
    p.shape_type,
    p.internal_height_cm,
    p.internal_width_cm,
    p.internal_length_cm,
    p.internal_diameter_cm,
    p.packaging_material,
    p.packaging_color,
    NULL::boolean AS has_inner_cradle,
    NULL::character varying(50) AS cradle_material,
    p.packaging_finish,
    p.is_imported,
    p.lead_time_days,
    NULL::boolean AS requires_minimum_order,
    p.supply_mode,
    p.is_thermal,
    p.capacity_ml,
    p.slug,
    p.ai_summary,
    p.key_benefits,
    p.use_cases,
    p.target_audience,
    p.schema_json,
    p.canonical_url,
    p.robots_meta,
    p.seo_score,
    p.seo_last_audit_at,
    p.seo_issues,
    p.og_title,
    p.og_description,
    p.og_image_url,
    p.description_packaging_info,
    p.has_optional_packaging,
    p.optional_packaging_ref,
    p.packing_classification,
    p.ipi_rate::numeric AS ipi_rate,
    p.tax_reference_state::character varying AS tax_reference_state,
    p.engraving_type,
    p.supplier_updated_at,
    p.has_gift_box,
    p.min_order_quantity,
    p.ai_title,
    p.ai_description,
    p.ai_version,
    p.ai_generated_at,
    p.ai_model,
    p.box_image,
    p.repacking_classification,
    p.has_commercial_packaging,
    p.packaging_context,
    p.bitrix_product_id,
    p.novelty_detected_at,
    p.novelty_expires_at,
    p.ncm_id,
    NULL::timestamp with time zone AS bitrix_images_synced_at,
    p.is_featured_expires_at,
    p.is_bestseller_expires_at,
    p.is_on_sale_expires_at,
    p.is_new_expires_at,
    p.supplier_product_url,
    p.freight_class,
    p.cubic_weight,
    NULL::text AS auto_category,
    p.auto_material,
    NULL::double precision AS classification_confidence,
    p.price_updated_at,
    NULL::text AS external_id,
    p.price_freshness_threshold_days,
    p.set_image_url,
    p.is_seasonal,
    p.pvc_free,
    p.supplier_type,
    p.supplier_subtype,
    p.supplier_type_code,
    p.supplier_subtype_code,
    p.price_verified_at,
    p.circumference_cm,
    p.search_vector,
    p.primary_image_fallback_url,
    COALESCE(lc.leaf_category_id, p.main_category_id, p.category_id) AS leaf_category_id,
    lc.leaf_category_name,
    lc.leaf_category_level,
    lc.leaf_category_slug,
    COALESCE(lc.leaf_category_id_safe, p.main_category_id, p.category_id) AS leaf_category_id_safe,
    p.color_swatches,
    p.dimensions_source,
    p.default_carrier,
    p.shipping_weight_kg,
    p.shipping_width_cm,
    p.shipping_height_cm,
    p.shipping_length_cm,
    p.requires_special_shipping,
    p.shipping_notes,
    p.icms_rate,
    p.pis_rate,
    p.cofins_rate,
    p.cfop,
    p.csosn,
    p.cest,
    p.tax_regime
   FROM products p
     LEFT JOIN internal.mv_product_leaf_category lc ON lc.product_id = p.id
  WHERE p.is_deleted IS NOT TRUE AND p.is_active = true;

-- Re-grant authenticated on the view (CREATE OR REPLACE may reset grants)
GRANT SELECT ON public.v_products_public TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 5b: Also update v_products_public_test (test view; same definition)
--           Must be done before dropping the public MV (dependency)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.v_products_public_test
  WITH (security_invoker = true)
AS
 SELECT p.id,
    p.name,
    p.description,
    p.sku,
    p.category_id,
    p.supplier_id,
    NULL::numeric AS cost_price,
    p.sale_price,
    p.stock_quantity,
    p.is_active AS active,
    p.created_at,
    p.updated_at,
    NULL::numeric AS suggested_price,
        CASE
            WHEN p.length_cm IS NOT NULL OR p.width_cm IS NOT NULL OR p.height_cm IS NOT NULL OR p.weight_g IS NOT NULL OR p.diameter_cm IS NOT NULL OR p.shape_type IS NOT NULL THEN jsonb_build_object('length_cm', p.length_cm, 'width_cm', p.width_cm, 'height_cm', p.height_cm, 'weight_g', p.weight_g, 'diameter_cm', p.diameter_cm, 'shape_type', p.shape_type, 'unit_detected', p.dimensions_source)
            ELSE NULL::jsonb
        END AS dimensions,
    p.images,
    p.primary_image_url,
    p.videos,
    p.allows_personalization,
    p.colors,
    p.materials,
    p.tags,
    p.meta_title,
    p.meta_description,
    p.meta_keywords,
    p.is_featured,
    p.is_new,
    p.is_on_sale,
    p.view_count,
    p.favorite_count,
    p.order_count,
    NULL::uuid AS organization_id,
    p.product_type,
    p.is_active,
    NULL::uuid AS created_by,
    NULL::uuid AS updated_by,
    p.sku_promo,
    p.short_description,
    p.main_category_id,
    p.brand,
    p.is_deleted,
    p.deleted_at,
    p.is_kit,
    p.is_bestseller,
    p.min_quantity,
    p.box_length_mm,
    p.box_width_mm,
    p.box_height_mm,
    p.box_weight_kg,
    p.has_colors,
    p.has_sizes,
    p.ean,
    p.gtin,
    p.ncm_code,
    p.origin_country,
    p.warranty_months,
    NULL::character varying(100) AS manufacturer_sku,
    p.last_stock_update_at,
    p.supplier_reference,
    p.is_textil,
    p.has_capacity,
    p.combined_sizes,
    p.gender,
    p.is_stockout,
    NULL::boolean AS is_online_exclusive,
    NULL::integer AS catalog_page,
    p.weight_g,
    p.length_cm,
    p.width_cm,
    p.height_cm,
    p.dimensions_display,
    p.box_length_cm,
    p.box_width_cm,
    p.box_height_cm,
    p.box_volume_cm3,
    p.box_quantity,
    p.box_inner_quantity,
    p.packing_type,
    p.repacking_type,
    p.capacities,
    NULL::timestamp with time zone AS last_sync_at,
    NULL::uuid AS last_sync_supplier_id,
    NULL::character varying AS sync_status,
    p.diameter_cm,
    p.shape_type,
    p.internal_height_cm,
    p.internal_width_cm,
    p.internal_length_cm,
    p.internal_diameter_cm,
    p.packaging_material,
    p.packaging_color,
    NULL::boolean AS has_inner_cradle,
    NULL::character varying(50) AS cradle_material,
    p.packaging_finish,
    p.is_imported,
    p.lead_time_days,
    NULL::boolean AS requires_minimum_order,
    p.supply_mode,
    p.is_thermal,
    p.capacity_ml,
    p.slug,
    p.ai_summary,
    p.key_benefits,
    p.use_cases,
    p.target_audience,
    p.schema_json,
    p.canonical_url,
    p.robots_meta,
    p.seo_score,
    p.seo_last_audit_at,
    p.seo_issues,
    p.og_title,
    p.og_description,
    p.og_image_url,
    p.description_packaging_info,
    p.has_optional_packaging,
    p.optional_packaging_ref,
    p.packing_classification,
    p.ipi_rate::numeric AS ipi_rate,
    p.tax_reference_state::character varying AS tax_reference_state,
    p.engraving_type,
    p.supplier_updated_at,
    p.has_gift_box,
    p.min_order_quantity,
    p.ai_title,
    p.ai_description,
    p.ai_version,
    p.ai_generated_at,
    p.ai_model,
    p.box_image,
    p.repacking_classification,
    p.has_commercial_packaging,
    p.packaging_context,
    p.bitrix_product_id,
    p.novelty_detected_at,
    p.novelty_expires_at,
    p.ncm_id,
    NULL::timestamp with time zone AS bitrix_images_synced_at,
    p.is_featured_expires_at,
    p.is_bestseller_expires_at,
    p.is_on_sale_expires_at,
    p.is_new_expires_at,
    p.supplier_product_url,
    p.freight_class,
    p.cubic_weight,
    NULL::text AS auto_category,
    p.auto_material,
    NULL::double precision AS classification_confidence,
    p.price_updated_at,
    NULL::text AS external_id,
    p.price_freshness_threshold_days,
    p.set_image_url,
    p.is_seasonal,
    p.pvc_free,
    p.supplier_type,
    p.supplier_subtype,
    p.supplier_type_code,
    p.supplier_subtype_code,
    p.price_verified_at,
    p.circumference_cm,
    p.search_vector,
    p.primary_image_fallback_url,
    COALESCE(lc.leaf_category_id, p.main_category_id, p.category_id) AS leaf_category_id,
    lc.leaf_category_name,
    lc.leaf_category_level,
    lc.leaf_category_slug,
    COALESCE(lc.leaf_category_id_safe, p.main_category_id, p.category_id) AS leaf_category_id_safe,
    p.color_swatches,
    p.dimensions_source,
    p.default_carrier,
    p.shipping_weight_kg,
    p.shipping_width_cm,
    p.shipping_height_cm,
    p.shipping_length_cm,
    p.requires_special_shipping,
    p.shipping_notes,
    p.icms_rate,
    p.pis_rate,
    p.cofins_rate,
    p.cfop,
    p.csosn,
    p.cest,
    p.tax_regime
   FROM products p
     LEFT JOIN internal.mv_product_leaf_category lc ON lc.product_id = p.id
  WHERE p.is_deleted IS NOT TRUE AND p.is_active = true;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 6: Drop public MV (now redundant — internal one is the source of truth)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP MATERIALIZED VIEW IF EXISTS public.mv_product_leaf_category;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 7: Validate
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_public_mv_exists  boolean;
  v_internal_mv_exists boolean;
  v_view_ok           boolean;
  v_row_count         int;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'mv_product_leaf_category' AND c.relkind = 'm'
  ) INTO v_public_mv_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'internal' AND c.relname = 'mv_product_leaf_category' AND c.relkind = 'm'
  ) INTO v_internal_mv_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'v_products_public' AND c.relkind = 'v'
  ) INTO v_view_ok;

  SELECT count(*) INTO v_row_count FROM internal.mv_product_leaf_category;

  RAISE NOTICE '[070] public.mv_product_leaf_category exists: % (expected: false)', v_public_mv_exists;
  RAISE NOTICE '[070] internal.mv_product_leaf_category exists: % (expected: true)', v_internal_mv_exists;
  RAISE NOTICE '[070] public.v_products_public exists: % (expected: true)', v_view_ok;
  RAISE NOTICE '[070] internal MV row count: %', v_row_count;

  IF NOT v_public_mv_exists AND v_internal_mv_exists AND v_view_ok THEN
    RAISE NOTICE '[070] materialized_view_in_api: CLEARED — MV removed from public schema';
  ELSE
    RAISE WARNING '[070] Validation failed: check above states';
  END IF;

  RAISE NOTICE 'Migration 070 complete.';
END;
$$;
