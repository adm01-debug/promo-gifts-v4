/**
 * Product Mapper
 *
 * Converts raw PromobrindProduct to the internal Product format.
 */
import { getCatalogStockStatus, type CatalogStockStatus } from '@/lib/catalog-stock-status';
import type { Product } from '@/types/product-catalog';
import {
  type PromobrindProduct,
  getProductImageUrl,
  getProductPrice,
  getProductStock,
} from '@/lib/external-db';
import { normalizeColors } from '@/utils/product-colors';

function getStockStatus(stock: number): CatalogStockStatus {
  return getCatalogStockStatus(stock);
}

// Janela de novidade alinhada ao módulo Novidades (useNovelties.NOVELTY_WINDOW_DAYS = 30)
const NOVELTY_WINDOW_DAYS = 30;
function isWithinNoveltyWindow(createdAt: unknown): boolean {
  if (typeof createdAt !== 'string' || !createdAt) return false;
  const ts = Date.parse(createdAt);
  if (Number.isNaN(ts)) return false;
  const elapsedDays = (Date.now() - ts) / 86400000;
  return elapsedDays >= 0 && elapsedDays <= NOVELTY_WINDOW_DAYS;
}

function parseMaterials(materials: unknown): string[] {
  if (!materials) return [];
  if (Array.isArray(materials)) return materials.filter(Boolean);
  if (typeof materials === 'string') {
    return materials
      .split(/[,;|]/)
      .map((m) => m.trim())
      .filter(Boolean);
  }
  return [];
}

function parseTagList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value))
    return value.filter((v): v is string => typeof v === 'string' && !!v.trim());
  if (typeof value === 'string')
    return value
      .split(/[,;|]/)
      .map((v) => v.trim())
      .filter(Boolean);
  return [];
}

function normalizeMarketingTags(rawTags: unknown): Product['tags'] {
  const tags = rawTags && typeof rawTags === 'object' ? (rawTags as Record<string, unknown>) : {};
  return {
    publicoAlvo: parseTagList(tags.publicoAlvo ?? tags.publico_alvo),
    datasComemorativas: parseTagList(tags.datasComemorativas ?? tags.datas_comemorativas),
    endomarketing: parseTagList(tags.endomarketing),
    ramo: parseTagList(tags.ramo ?? tags.ramosAtividade ?? tags.ramos_atividade),
    nicho: parseTagList(tags.nicho ?? tags.segmentosAtividade ?? tags.segmentos_atividade),
  };
}

/** Converte produto Promobrind para formato interno */
export function mapPromobrindToProduct(p: PromobrindProduct): Product {
  const imageUrl = getProductImageUrl(p);
  const stock = getProductStock(p);
  const colors = normalizeColors(p.colors ?? undefined);

  // Extrair imagens
  let images: string[] = [];
  if (p.images && Array.isArray(p.images)) {
    images = (p.images as (string | Record<string, string>)[])
      .map((img) => {
        if (typeof img === 'string') return img;
        return img.url || img.src || (img.image_url ?? '');
      })
      .filter(Boolean);
  }
  if (images.length === 0 && imageUrl) images = [imageUrl];
  if (images.length === 0) images = ['/placeholder.svg'];

  type InternalVariation = {
    id: string;
    sku: string;
    color: { name: string; hex: string };
    stock: number;
    image: string | null;
    images: string[];
    videos: unknown[];
    size_code: string | null;
  };
  // Mapear variações
  const variations: InternalVariation[] = [];
  if (p.colors && Array.isArray(p.colors)) {
    p.colors.forEach((c, index: number) => {
      if (typeof c === 'object' && c !== null && 'name' in c) {
        const co = c as {
          name: string;
          hex?: string;
          stock?: number;
          sku?: string;
          image?: string;
          images?: string[];
          size_code?: string;
        };
        variations.push({
          id: `${p.id}-${index}`,
          sku: co.sku || p.sku,
          color: { name: co.name, hex: co.hex || '#CCCCCC' },
          stock: co.stock ?? 0,
          image: co.image || null,
          images: co.images ?? [],
          videos: [],
          size_code: co.size_code || null,
        });
      }
    });
  }

  return {
    id: p.id,
    name: p.name,
    description: p.description || p.short_description || p.meta_description || null,
    shortDescription: p.short_description ?? null,
    category_id: p.category_id || p.main_category_id || null,
    category_name: p.category_name || null,
    price: getProductPrice(p),
    image_url: images[0],
    primary_image_url: p.primary_image_url || null,
    primary_image_fallback_url: p.primary_image_fallback_url || null,
    og_image_url: p.og_image_url || undefined,
    set_image_url: p.set_image_url ?? null,
    images,
    sku: p.sku,
    stock,
    colors: colors as never,
    materials: parseMaterials(p.materials),
    supplier_reference: p.supplier_reference,
    brand: p.brand,
    is_active: p.is_active || p.active,
    minQuantity: p.min_quantity || 1,
    stockStatus: getStockStatus(stock),
    featured: Boolean(p.is_featured || p.is_bestseller),
    newArrival:
      Boolean(p.is_new) || isWithinNoveltyWindow((p as { created_at?: unknown }).created_at),
    onSale: Boolean(p.is_on_sale),
    isKit: Boolean(p.is_kit),
    gender: p.gender || null,
    category: {
      id: p.category_id || p.main_category_id || '0',
      name: p.category_name || 'Sem categoria',
    },
    supplier: {
      id: p.supplier_id || p.supplier_reference || p.brand || 'unknown',
      name: p.supplier_name || p.brand || 'Fornecedor',
    },
    tags: normalizeMarketingTags(p.tags),
    dimensions: {
      height_cm: p.height_cm,
      width_cm: p.width_cm,
      length_cm: p.length_cm,
      diameter_cm: p.diameter_cm,
      circumference_cm: p.circumference_cm,
      weight_g: p.weight_g,
      capacity_ml: p.capacity_ml,
    },
    packingType: p.packing_type,
    packingClassification: p.packing_classification,
    hasCommercialPackaging: p.has_commercial_packaging,
    hasPersonalization: p.allows_personalization,
    repackingType: p.repacking_type,
    packagingContext: p.packaging_context as Product['packagingContext'],
    boxImage: p.box_image,
    boxWidthMm: p.box_width_mm,
    boxHeightMm: p.box_height_mm,
    boxLengthMm: p.box_length_mm,
    boxWeightKg: p.box_weight_kg,
    boxQuantity: p.box_quantity,
    boxVolumeCm3: p.box_volume_cm3,
    leadTimeDays: p.lead_time_days ?? null,
    // SSOT: coluna dedicada `price_updated_at` no BD externo (Promobrind),
    // mantida por trigger automático em mudanças de preço (cost_price,
    // sale_price, suggested_price, list_price, cost_price_1..5).
    // Precedência: price_updated_at SEMPRE vence quando presente; só caímos
    // em `updated_at` se o campo oficial for null/undefined/string vazia
    // (~0,08% dos produtos hoje — registros antigos sem trigger disparado).
    priceUpdatedAt:
      (typeof p.price_updated_at === 'string' && p.price_updated_at.trim() !== ''
        ? p.price_updated_at
        : null) ??
      (typeof p.updated_at === 'string' && p.updated_at.trim() !== '' ? p.updated_at : null),
    priceFreshnessThresholdDays: p.price_freshness_threshold_days ?? null,
    variations: variations.length > 0 ? (variations as never) : undefined,
    productVideos: p.product_videos?.length ? p.product_videos : undefined,
    kitItems:
      p.kit_components?.map((c) => {
        const ck = c as Record<string, unknown>;
        return {
          id: c.id,
          productId: c.component_product_id || c.id,
          productName: c.component_name || 'Componente',
          quantity: c.quantity || 1,
          sku: c.component_sku || (c.component_code ?? ''),
          imageUrl: c.primary_image_url || null,
          isOptional: c.is_optional || false,
          isPackaging: c.is_packaging || false,
          isReplaceable: c.is_replaceable || false,
          allowsPersonalization: c.allows_personalization || false,
          material: c.material || null,
          weightG: c.weight_g || null,
          heightMm: c.height_mm ?? null,
          widthMm: c.width_mm ?? null,
          lengthMm: c.length_mm ?? null,
          componentTypeCode: (ck.component_type_code ?? null) as string | null,
          supplierComponentCode: (ck.supplier_component_code ?? null) as string | null,
          description: (ck.component_description ?? null) as string | null,
          personalizationNotes: (ck.personalization_notes ?? null) as string | null,
          color: (ck.color ?? null) as string | null,
        };
      }) || undefined,
    // Word Magic — campos gerados por IA
    aiTitle: p.ai_title ?? null,
    aiDescription: p.ai_description ?? null,
    aiSummary: p.ai_summary ?? null,
    aiVersion: typeof p.ai_version === 'number' ? p.ai_version : null,
    aiGeneratedAt: p.ai_generated_at ?? null,
  };
}
