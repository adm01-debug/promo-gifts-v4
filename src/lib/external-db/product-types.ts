/**
 * PromobrindProduct type + helper functions.
 */
import { toErrorMessage } from '@/lib/to-error-message';

export interface PromobrindProduct {
  id: string;
  name: string;
  sku: string;
  sale_price?: number | null;
  /** @deprecated Use sale_price */
  base_price?: number | null;
  /** @deprecated No longer exists in external DB. Use primary_image_url or images */
  image_url?: string | null;
  images: string[] | null;
  primary_image_url: string | null;
  primary_image_blurhash?: string | null;
  primary_image_fallback_url?: string | null;
  set_image_url?: string | null;
  og_image_url?: string | null;
  category_id: string | null;
  main_category_id: string | null;
  supplier_id: string | null;
  supplier_reference: string | null;
  /** @deprecated No longer exists in external DB. Use brand */
  supplier_name?: string | null;
  description: string | null;
  short_description: string | null;
  meta_description?: string | null;
  brand: string | null;
  is_active: boolean;
  active: boolean;
  stock_quantity?: number | null;
  colors?: Array<string | { name: string; hex?: string; stock?: number }> | null;
  materials?: Array<Record<string, unknown> | string> | null;
  dimensions?: string | null;
  min_quantity?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  height_cm?: number | null;
  width_cm?: number | null;
  length_cm?: number | null;
  diameter_cm?: number | null;
  circumference_cm?: number | null;
  weight_g?: number | null;
  capacity_ml?: number | null;
  packing_type?: string | null;
  packing_classification?: string | null;
  has_commercial_packaging?: boolean | null;
  repacking_type?: string | null;
  packaging_context?: string | null;
  box_image?: string | null;
  box_width_mm?: number | null;
  box_height_mm?: number | null;
  box_length_mm?: number | null;
  box_weight_kg?: number | null;
  box_quantity?: number | null;
  box_volume_cm3?: number | null;
  product_videos?: Array<{
    id: string;
    url_stream: string | null;
    url_hls: string | null;
    url_thumbnail: string | null;
    url_original: string | null;
    source_youtube_id: string | null;
    video_type: string | null;
    display_order: number;
    is_primary: boolean;
    title: string | null;
  }> | null;
  is_featured?: boolean | null;
  is_bestseller?: boolean | null;
  is_new?: boolean | null;
  is_on_sale?: boolean | null;
  is_kit?: boolean | null;
  gender?: string | null;
  category_name?: string | null;
  tags?: Record<string, unknown> | null;
  price_updated_at?: string | null;
  price_freshness_threshold_days?: number | null;
  kit_components?: Array<{
    id: string;
    component_name: string | null;
    component_code: string | null;
    component_product_id: string | null;
    component_sku: string | null;
    quantity: number | null;
    display_order: number | null;
    is_optional: boolean | null;
    is_packaging: boolean | null;
    is_replaceable: boolean | null;
    allows_personalization: boolean | null;
    material: string | null;
    primary_image_url: string | null;
    primary_image_fallback_url?: string | null;
    height_mm: number | null;
    width_mm: number | null;
    length_mm: number | null;
    weight_g: number | null;
    notes: string | null;
    // Campos provenientes do join `product_kit_components` × `products`
    // (vide JSON_BUILD_OBJECT em supabase/migrations/20250103070000…).
    // Podem vir ausentes em produtos mais antigos sem catálogo completo.
    component_type_code?: string | null;
    supplier_component_code?: string | null;
    component_description?: string | null;
    personalization_notes?: string | null;
    color?: string | null;
    // Galeria + dimensões circulares (kits nativos do fornecedor).
    images?: unknown | null; // jsonb[] heterogêneo — normalizado no mapper
    diameter_mm?: number | null;
    circumference_mm?: number | null;
    capacity_ml?: number | null;
  }> | null;

  // ------------------------------------------------------------------
  // Campos adicionais mapeados pelo formulário admin (AdminProductFormPage).
  // Colunas reais (ou potenciais) da base externa; todas opcionais/nullable
  // porque nem todo SELECT as traz — os consumidores aplicam `?? default`.
  // ------------------------------------------------------------------
  // Pricing / estoque
  cost_price?: number | null;
  suggested_price?: number | null;
  stock_unit?: string | null;
  product_type?: string | null;
  min_order_quantity?: number | null;
  // Dimensões internas
  internal_height_cm?: number | null;
  internal_width_cm?: number | null;
  internal_length_cm?: number | null;
  internal_diameter_cm?: number | null;
  // Embalagem
  packaging_material?: string | null;
  packaging_color?: string | null;
  packaging_finish?: string | null;
  // Flags de destaque + expiração
  is_featured_expires_at?: string | null;
  is_bestseller_expires_at?: string | null;
  is_new_expires_at?: string | null;
  novelty_expires_at?: string | null;
  is_on_sale_expires_at?: string | null;
  // Flags de característica
  is_imported?: boolean | null;
  is_textil?: boolean | null;
  is_thermal?: boolean | null;
  allows_personalization?: boolean | null;
  has_gift_box?: boolean | null;
  has_optional_packaging?: boolean | null;
  // Fiscal
  ncm_code?: string | null;
  ean?: string | null;
  gtin?: string | null;
  ipi_rate?: number | null;
  country_of_origin?: string | null;
  origin_country?: string | null;
  // Edit-form round-trip fields (present in v_products_public; previously untyped).
  supplier_product_url?: string | null;
  box_inner_quantity?: number | null;
  cfop?: string | null;
  csosn?: string | null;
  icms_rate?: number | null;
  pis_rate?: number | null;
  cofins_rate?: number | null;
  tax_regime?: string | null;
  cest?: string | null;
  // Logística / frete
  freight_class?: string | null;
  default_carrier?: string | null;
  shipping_weight_kg?: number | null;
  shipping_width_cm?: number | null;
  shipping_height_cm?: number | null;
  shipping_length_cm?: number | null;
  cubic_weight?: number | null;
  requires_special_shipping?: boolean | null;
  shipping_notes?: string | null;
  lead_time_days?: number | null;
  supply_mode?: string | null;
  warranty_months?: number | null;
  // SEO / mídia
  meta_title?: string | null;
  meta_keywords?: string[] | null;
  slug?: string | null;
  canonical_url?: string | null;
  videos?: string[] | null;
  video_url?: string | null;
  key_benefits?: string | null;
  use_cases?: string | null;
  // Nomes denormalizados (fallback de exibição)
  category?: string | null;
  supplier?: string | null;
  // Word Magic — campos gerados por IA (word-magic Edge Function)
  ai_title?: string | null;
  ai_description?: string | null;
  ai_summary?: string | null;
  ai_version?: number | null;
  ai_generated_at?: string | null;
}

export function getProductImageUrl(product: PromobrindProduct): string | null {
  return product.primary_image_url || product.image_url || (product.images?.[0] ?? null);
}

export function getProductPrice(product: PromobrindProduct): number {
  return product.sale_price ?? product.base_price ?? 0;
}

export function getProductStock(product: PromobrindProduct): number {
  return product.stock_quantity || 0;
}

// Select field constants
// NOTE: `price_updated_at` is the SSOT for price freshness — populated via
// trigger on the external Promobrind DB whenever any price field changes.
// `price_freshness_threshold_days` é opcional durante a transição de schema.
// Não selecionamos a coluna por padrão para evitar 400/tela branca quando o
// schema do BD externo ainda não foi aplicado; consumidores usam default 60d.
export const PRODUCT_SELECT_FIELDS_WITH_SALE =
  'id, name, sku, sale_price, cost_price, images, primary_image_url, primary_image_fallback_url, set_image_url, ' +
  'category_id, main_category_id, supplier_id, supplier_reference, description, ' +
  'short_description, meta_description, brand, is_active, active, stock_quantity, colors, ' +
  'materials, dimensions, min_quantity, created_at, updated_at, price_updated_at, ' +
  'price_freshness_threshold_days, ' +
  'is_featured, is_bestseller, is_new, is_on_sale, is_kit, gender, ' +
  'height_cm, width_cm, length_cm, diameter_cm, circumference_cm, weight_g, capacity_ml, ' +
  'packing_type, packing_classification, has_commercial_packaging, repacking_type, packaging_context, ' +
  'box_image, box_width_mm, box_height_mm, box_length_mm, box_weight_kg, box_quantity, box_volume_cm3, ai_title, ai_description, ai_summary, ai_version, ai_generated_at';

export const PRODUCT_SELECT_FIELDS_WITH_SALE_NO_THRESHOLD =
  'id, name, sku, sale_price, cost_price, images, primary_image_url, primary_image_fallback_url, set_image_url, ' +
  'category_id, main_category_id, supplier_id, supplier_reference, description, ' +
  'short_description, meta_description, brand, is_active, active, stock_quantity, colors, ' +
  'materials, dimensions, min_quantity, created_at, updated_at, price_updated_at, ' +
  'is_featured, is_bestseller, is_new, is_on_sale, is_kit, gender, ' +
  'height_cm, width_cm, length_cm, diameter_cm, circumference_cm, weight_g, capacity_ml, ' +
  'packing_type, packing_classification, has_commercial_packaging, repacking_type, packaging_context, ' +
  'box_image, box_width_mm, box_height_mm, box_length_mm, box_weight_kg, box_quantity, box_volume_cm3, ai_title, ai_description, ai_summary, ai_version, ai_generated_at';

export const PRODUCT_SELECT_FIELDS_LEGACY =
  'id, name, sku, cost_price, images, primary_image_url, primary_image_fallback_url, set_image_url, ' +
  'category_id, main_category_id, supplier_id, supplier_reference, description, ' +
  'short_description, meta_description, brand, is_active, active, stock_quantity, colors, ' +
  'materials, dimensions, min_quantity, created_at, updated_at, price_updated_at, ' +
  'price_freshness_threshold_days, ' +
  'is_featured, is_bestseller, is_new, is_on_sale, is_kit, ' +
  'height_cm, width_cm, length_cm, diameter_cm, circumference_cm, weight_g, capacity_ml, ' +
  'packing_type, packing_classification, has_commercial_packaging, repacking_type, packaging_context, ' +
  'box_image, box_width_mm, box_height_mm, box_length_mm, box_weight_kg, box_quantity, box_volume_cm3, ai_title, ai_description, ai_summary, ai_version, ai_generated_at';

export const PRODUCT_SELECT_FIELDS_LEGACY_NO_THRESHOLD =
  'id, name, sku, cost_price, images, primary_image_url, primary_image_fallback_url, set_image_url, ' +
  'category_id, main_category_id, supplier_id, supplier_reference, description, ' +
  'short_description, meta_description, brand, is_active, active, stock_quantity, colors, ' +
  'materials, dimensions, min_quantity, created_at, updated_at, price_updated_at, ' +
  'is_featured, is_bestseller, is_new, is_on_sale, is_kit, ' +
  'height_cm, width_cm, length_cm, diameter_cm, circumference_cm, weight_g, capacity_ml, ' +
  'packing_type, packing_classification, has_commercial_packaging, repacking_type, packaging_context, ' +
  'box_image, box_width_mm, box_height_mm, box_length_mm, box_weight_kg, box_quantity, box_volume_cm3, ai_title, ai_description, ai_summary, ai_version, ai_generated_at';

export const PRODUCT_SELECT_FIELDS_DETAIL =
  'id, name, sku, sale_price, cost_price, images, primary_image_url, primary_image_fallback_url, set_image_url, ' +
  'category_id, main_category_id, supplier_id, supplier_reference, description, ' +
  'short_description, meta_description, brand, is_active, active, stock_quantity, colors, ' +
  'materials, dimensions, min_quantity, created_at, updated_at, price_updated_at, ' +
  'price_freshness_threshold_days, ' +
  'is_featured, is_bestseller, is_new, is_on_sale, is_kit, tags, ' +
  'height_cm, width_cm, length_cm, diameter_cm, circumference_cm, weight_g, capacity_ml, ' +
  'packing_type, packing_classification, has_commercial_packaging, repacking_type, packaging_context, ' +
  'box_image, box_width_mm, box_height_mm, box_length_mm, box_weight_kg, box_quantity, box_volume_cm3, ai_title, ai_description, ai_summary, ai_version, ai_generated_at';

export const PRODUCT_SELECT_FIELDS_DETAIL_NO_THRESHOLD =
  'id, name, sku, sale_price, cost_price, images, primary_image_url, primary_image_fallback_url, set_image_url, ' +
  'category_id, main_category_id, supplier_id, supplier_reference, description, ' +
  'short_description, meta_description, brand, is_active, active, stock_quantity, colors, ' +
  'materials, dimensions, min_quantity, created_at, updated_at, price_updated_at, ' +
  'is_featured, is_bestseller, is_new, is_on_sale, is_kit, tags, ' +
  'height_cm, width_cm, length_cm, diameter_cm, circumference_cm, weight_g, capacity_ml, ' +
  'packing_type, packing_classification, has_commercial_packaging, repacking_type, packaging_context, ' +
  'box_image, box_width_mm, box_height_mm, box_length_mm, box_weight_kg, box_quantity, box_volume_cm3, ai_title, ai_description, ai_summary, ai_version, ai_generated_at';

// #2: also trigger fallback when orderBy hits a missing column
export function shouldFallbackSelect(err: unknown) {
  const msg = toErrorMessage(err);
  return /(sale_price|base_price|image_url|supplier_name|category_name|product_videos|selected_images|gender|price_updated_at|price_freshness_threshold_days|does not exist|não existe|undefined column|column .+ does not exist|could not identify an ordering operator|order by)/i.test(
    msg,
  );
}
