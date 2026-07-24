-- [APLICADO 2026-06-22 13:00 UTC] fix_color_swatches_column_and_view_plus_favorites_grant
--
-- ROOT CAUSE BUG-1 (HTTP 400 em v_products_public):
--   O frontend (product-types.ts) incluía `color_swatches` e `has_colors` em TODOS os
--   PRODUCT_SELECT_FIELDS_*. A coluna `color_swatches` existia como FUNÇÃO e TRIGGER
--   (fn_rebuild_color_swatches, fn_trigger_rebuild_swatches_on_variant,
--    fn_trigger_rebuild_swatches_on_image) mas o ALTER TABLE ADD COLUMN nunca foi executado.
--   PostgREST retornava HTTP 400 em 100% das queries de produto.
--
-- ROOT CAUSE BUG-2 (HTTP 404 em rpc/get_favorite_list_counts):
--   Função existia com SECURITY DEFINER e usa auth.uid(), mas sem EXECUTE grant
--   para a role `authenticated`. PostgREST retorna 404 quando a função existe
--   mas não é acessível ao role corrente.
--
-- BUG-3 (SW crash): efeito cascata do BUG-1 (app em branco → SW não conseguia cachear /).
--
-- Aplicado via apply_migration no projeto doufsxqlfjyuvxuezpln (sa-east-1).
-- Verificado: 30/30 smoke tests — 22 PASS, 8 WARN (pré-existentes), 0 FAIL.

-- ============================================================
-- 1. Adicionar coluna color_swatches na tabela products
-- ============================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS color_swatches jsonb DEFAULT '[]'::jsonb;

-- ============================================================
-- 2. Recriar view v_products_public para incluir color_swatches
--    (idempotente via CREATE OR REPLACE)
-- ============================================================
CREATE OR REPLACE VIEW public.v_products_public AS
 SELECT p.id,
    p.name,
    p.description,
    p.sku,
    p.category_id,
    p.supplier_id,
    NULL::numeric AS cost_price,
    p.sale_price,
    p.stock_quantity,
    p.active,
    p.created_at,
    p.updated_at,
    NULL::numeric AS suggested_price,
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
    NULL::numeric AS ipi_rate,
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
    NULL::integer AS bitrix_product_id,
    p.novelty_detected_at,
    p.novelty_expires_at,
    NULL::uuid AS ncm_id,
    NULL::timestamp with time zone AS bitrix_images_synced_at,
    p.is_featured_expires_at,
    p.is_bestseller_expires_at,
    p.is_on_sale_expires_at,
    p.is_new_expires_at,
    NULL::text AS supplier_product_url,
    p.freight_class,
    p.cubic_weight,
    p.auto_category,
    p.auto_material,
    p.classification_confidence,
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
    p.color_swatches
   FROM products p
     LEFT JOIN mv_product_leaf_category lc ON lc.product_id = p.id
  WHERE p.is_deleted IS NOT TRUE AND p.is_active = true;

-- ============================================================
-- 3. Reforçar grants na view (idempotente)
-- ============================================================
GRANT SELECT ON public.v_products_public TO authenticated, anon;

-- ============================================================
-- 4. GRANT EXECUTE em get_favorite_list_counts para authenticated
--    Função: SECURITY DEFINER, usa auth.uid(), retorna TABLE(list_id uuid, item_count bigint)
--    Sem este grant, PostgREST retorna HTTP 404 mesmo com a função existindo
-- ============================================================
GRANT EXECUTE ON FUNCTION public.get_favorite_list_counts() TO authenticated;

-- ============================================================
-- 5. Reload schema cache do PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
