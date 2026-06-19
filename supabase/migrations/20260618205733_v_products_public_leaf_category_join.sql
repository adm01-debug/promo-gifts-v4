-- DRIFT MIGRATION (2026-06-19 audit GAP-4)
-- v_products_public v3: recriada com JOIN em mv_product_leaf_category (level-first).
--
-- Inclui todas as colunas de products + leaf_category_id/name/level/slug
-- calculados a partir de mv_product_leaf_category com algoritmo level-first.
--
-- ATENÇÃO: este migration usa DROP CASCADE + CREATE VIEW porque a view depende
-- de mv_product_leaf_category. Executar somente se mv_product_leaf_category
-- já tiver sido recriada com a versão level-first (migration 20260618205528).
-- --------------------------------------------------------------------------

DROP VIEW IF EXISTS public.v_products_public CASCADE;

CREATE VIEW public.v_products_public
  WITH (security_invoker = false)
AS
SELECT
  p.id,
  p.name,
  p.description,
  p.sku,
  p.category_id,
  p.supplier_id,
  NULL::numeric           AS cost_price,
  p.sale_price,
  p.stock_quantity,
  p.active,
  p.created_at,
  p.updated_at,
  NULL::numeric           AS suggested_price,
  p.dimensions,
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
  NULL::uuid              AS organization_id,
  p.product_type,
  p.is_active,
  NULL::uuid              AS created_by,
  NULL::uuid              AS updated_by,
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
  p.manufacturer_sku,
  p.last_stock_update_at,
  p.supplier_reference,
  p.is_textil,
  p.has_capacity,
  p.combined_sizes,
  p.gender,
  p.is_stockout,
  p.is_online_exclusive,
  p.catalog_page,
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
  NULL::uuid              AS last_sync_supplier_id,
  NULL::character varying AS sync_status,
  p.diameter_cm,
  p.shape_type,
  p.internal_height_cm,
  p.internal_width_cm,
  p.internal_length_cm,
  p.internal_diameter_cm,
  p.packaging_material,
  p.packaging_color,
  p.has_inner_cradle,
  p.cradle_material,
  p.packaging_finish,
  p.is_imported,
  p.lead_time_days,
  p.requires_minimum_order,
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
  NULL::numeric           AS ipi_rate,
  NULL::character varying AS tax_reference_state,
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
  NULL::integer           AS bitrix_product_id,
  p.novelty_detected_at,
  p.novelty_expires_at,
  NULL::uuid              AS ncm_id,
  NULL::timestamp with time zone AS bitrix_images_synced_at,
  p.is_featured_expires_at,
  p.is_bestseller_expires_at,
  p.is_on_sale_expires_at,
  p.is_new_expires_at,
  NULL::text              AS supplier_product_url,
  p.freight_class,
  p.cubic_weight,
  p.auto_category,
  p.auto_material,
  p.classification_confidence,
  p.price_updated_at,
  NULL::text              AS external_id,
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
  -- Leaf category via mv_product_leaf_category (level-first algorithm)
  COALESCE(lc.leaf_category_id, p.main_category_id, p.category_id) AS leaf_category_id,
  COALESCE(lc.leaf_category_name, NULL::text)                       AS leaf_category_name,
  lc.leaf_category_level,
  lc.leaf_category_slug
FROM products p
LEFT JOIN mv_product_leaf_category lc ON lc.product_id = p.id
WHERE p.is_deleted IS NOT TRUE
  AND p.is_active = true;

-- Grants
GRANT SELECT ON public.v_products_public TO anon, authenticated;
GRANT ALL   ON public.v_products_public TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.v_products_public FROM anon, authenticated, public;

-- Recriar get_catalog_bestseller_page que foi dropada em CASCADE
CREATE OR REPLACE FUNCTION public.get_catalog_bestseller_page(
  p_sort   text    DEFAULT 'best-seller-supplier',
  p_limit  integer DEFAULT 500,
  p_offset integer DEFAULT 0
)
RETURNS SETOF public.v_products_public
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $fn$
DECLARE
  v_limit  integer := GREATEST(COALESCE(p_limit, 500), 0);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_sql    text;
BEGIN
  IF p_sort = 'best-seller-supplier' THEN
    v_sql := '
      SELECT vp.* FROM public.v_products_public vp
      LEFT JOIN public.mv_product_intelligence mi ON mi.product_id = vp.id
      WHERE vp.active = true
      ORDER BY COALESCE(mi.turnover_score, 0) DESC NULLS LAST, vp.name ASC, vp.id ASC
      LIMIT ' || v_limit || ' OFFSET ' || v_offset;
  ELSIF p_sort = 'best-seller-promo' THEN
    v_sql := '
      SELECT vp.* FROM public.v_products_public vp
      LEFT JOIN (
        SELECT product_id AS pid, sum(COALESCE(quantity, 1)) AS promo_qty
        FROM public.quote_items WHERE product_id IS NOT NULL GROUP BY product_id
      ) qs ON qs.pid = vp.id
      WHERE vp.active = true
      ORDER BY COALESCE(qs.promo_qty, 0) DESC NULLS LAST,
               COALESCE(vp.is_bestseller, false) DESC,
               vp.name ASC, vp.id ASC
      LIMIT ' || v_limit || ' OFFSET ' || v_offset;
  ELSE
    v_sql := '
      SELECT vp.* FROM public.v_products_public vp
      WHERE vp.active = true ORDER BY vp.name ASC, vp.id ASC
      LIMIT ' || v_limit || ' OFFSET ' || v_offset;
  END IF;
  RETURN QUERY EXECUTE v_sql;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_catalog_bestseller_page(text,integer,integer)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
