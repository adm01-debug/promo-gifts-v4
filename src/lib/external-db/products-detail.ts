import { dbInvoke } from '@/lib/db/postgrest';
import { logger } from '@/lib/logger';
/**
 * Products detail fetching — uses the Promobrind Gold DB.
 */

export interface PromobrindProductDetail {
  id: string;
  name?: string | null;
  description?: string | null;
  sku?: string | null;
  category_id?: string | null;
  supplier_id?: string | null;
  cost_price?: number | null;
  sale_price?: number | null;
  stock_quantity?: number | null;
  active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  suggested_price?: number | null;
  dimensions?: Record<string, unknown> | null;
  images?: unknown[] | null;
  primary_image_url?: string | null;
  videos?: unknown[] | null;
  allows_personalization?: boolean | null;
  colors?: unknown[] | null;
  materials?: unknown[] | null;
  tags?: unknown[] | null;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string[] | null;
  is_featured?: boolean | null;
  is_new?: boolean | null;
  is_on_sale?: boolean | null;
  view_count?: number | null;
  favorite_count?: number | null;
  order_count?: number | null;
  organization_id?: string | null;
  product_type?: string | null;
  is_active?: boolean | null;
  created_by?: string | null;
  updated_by?: string | null;
  [key: string]: unknown;
}

export interface PromobrindKitComponent {
  id: string;
  component_name?: string | null;
  component_code?: string | null;
  component_product_id?: string | null;
  component_sku?: string | null;
  component_description?: string | null;
  quantity?: number | null;
  display_order?: number | null;
  is_optional?: boolean | null;
  is_packaging?: boolean | null;
  is_replaceable?: boolean | null;
  allows_personalization?: boolean | null;
  personalization_notes?: string | null;
  material?: string | null;
  color?: string | null;
  primary_image_url?: string | null;
  images?: unknown[] | null;
  height_mm?: number | null;
  width_mm?: number | null;
  length_mm?: number | null;
  diameter_mm?: number | null;
  circumference_mm?: number | null;
  weight_g?: number | null;
  // capacity_ml is NOT a column in product_kit_components (PostgREST 400/42703)
  // If this dimension is needed, it must be added via DB migration first.
  capacity_ml: number | null;
  supplier_component_code?: string | null;
  component_type_code?: string | null;
  notes?: string | null;
  [key: string]: unknown;
}

export interface PromobrindProductVariantColor {
  id: string;
  color_name?: string | null;
  color_hex?: string | null;
  color_code?: string | null;
  sku?: string | null;
  stock_quantity?: number | null;
  is_active?: boolean | null;
  capacity_ml?: number | null;
}

// Fetch product details by ID or SKU
export async function fetchPromobrindProductDetail(
  productId: string,
): Promise<PromobrindProductDetail | null> {
  try {
    const result = await dbInvoke<PromobrindProductDetail>({
      table: 'products',
      operation: 'select',
      filters: { id: productId, is_active: true },
      limit: 1,
    });
    return result.records[0] ?? null;
  } catch (err) {
    logger.error('[products-detail] fetchPromobrindProductDetail error:', err);
    return null;
  }
}

export async function fetchPromobrindProductDetailBySku(
  sku: string,
): Promise<PromobrindProductDetail | null> {
  try {
    const result = await dbInvoke<PromobrindProductDetail>({
      table: 'products',
      operation: 'select',
      filters: { sku, is_active: true },
      limit: 1,
    });
    return result.records[0] ?? null;
  } catch (err) {
    logger.error('[products-detail] fetchPromobrindProductDetailBySku error:', err);
    return null;
  }
}

export async function fetchPromobrindKitComponents(
  productId: string,
): Promise<PromobrindKitComponent[]> {
  try {
    const result = await dbInvoke<PromobrindKitComponent>({
      table: 'product_kit_components',
      operation: 'select',
      // FIX 2026-06-27: capacity_ml não existe em product_kit_components (42703) → removido do select.
      // Se a coluna for adicionada no futuro via migration, incluí-la novamente aqui e em KIT_AUDITED_FIELDS.
      select:
        'id, component_name, component_code, component_product_id, component_sku, component_description, quantity, display_order, is_optional, is_packaging, is_replaceable, allows_personalization, personalization_notes, material, color, primary_image_url, images, height_mm, width_mm, length_mm, diameter_mm, circumference_mm, weight_g, supplier_component_code, component_type_code, notes',
      filters: { kit_product_id: productId },
      orderBy: { column: 'display_order', ascending: true },
    });
    return result.records || [];
  } catch (err) {
    logger.error('[products-detail] fetchPromobrindKitComponents error:', err);
    return [];
  }
}

export async function fetchPromobrindProductColors(
  productId: string,
): Promise<PromobrindProductVariantColor[]> {
  try {
    const result = await dbInvoke<PromobrindProductVariantColor>({
      table: 'product_variants',
      operation: 'select',
      select: 'id, color_name, color_hex, color_code, sku, stock_quantity',
      filters: { product_id: productId, is_active: true },
      orderBy: { column: 'color_name', ascending: true },
      limit: 100,
    });
    return result.records || [];
  } catch (err) {
    logger.error('[products-detail] fetchPromobrindProductColors error:', err);
    return [];
  }
}

export async function fetchPromobrindProductImages(productId: string) {
  try {
    const result = await dbInvoke({
      table: 'product_images',
      operation: 'select',
      filters: { product_id: productId, is_active: true },
      orderBy: { column: 'display_order', ascending: true },
    });
    return result.records || [];
  } catch (err) {
    logger.error('[products-detail] fetchPromobrindProductImages error:', err);
    return [];
  }
}

export async function fetchPromobrindProductVideos(productId: string) {
  try {
    const result = await dbInvoke({
      table: 'product_videos',
      operation: 'select',
      filters: { product_id: productId, is_active: true },
      orderBy: { column: 'display_order', ascending: true },
    });
    return result.records || [];
  } catch (err) {
    logger.error('[products-detail] fetchPromobrindProductVideos error:', err);
    return [];
  }
}
