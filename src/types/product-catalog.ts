/**
 * Product Catalog Types (Runtime/UI)
 *
 * These are the runtime types used throughout the UI.
 * Distinct from src/types/product.ts which holds DB-oriented types.
 */

export interface ProductColor {
  name: string;
  hex: string;
  group: string;
  groupSlug?: string;
  variationSlug?: string;
  code?: string;
  image?: string;
  images?: string[];
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  price: number;
  image_url?: string;
  /**
   * URL da imagem "set" (todas as cores juntas) no Cloudflare Images.
   * Sem sufixo de variante — concatenar "/public" para exibição.
   * Quando presente, usada como imagem de hover no catálogo (crossfade CSS).
   * null/undefined = produto não tem set → card mostra imagem estática.
   * Fontes: SPOT (image_type=set original) + XBZ (d1 reclassificado, 2026-06-02).
   */
  set_image_url?: string | null;
  og_image_url?: string;
  images: string[];
  sku: string;
  stock: number;
  created_at?: string;
  updated_at?: string;
  colors: ProductColor[];
  materials: string[];
  supplier_reference?: string | null;
  brand?: string | null;
  is_active?: boolean;
  minQuantity: number;

  dimensions?: {
    height_cm?: number | null;
    width_cm?: number | null;
    length_cm?: number | null;
    diameter_cm?: number | null;
    weight_g?: number | null;
    capacity_ml?: number | null;
  };

  packingType?: string | null;
  packingClassification?: string | null;
  hasCommercialPackaging?: boolean | null;
  /** BUG-15c: adicionado para suportar filtro hasPersonalization no Super Filtro e Catálogo.
   *  Mapeado do campo has_personalization na DB (via product mapper). */
  hasPersonalization?: boolean | null;
  repackingType?: string | null;
  packagingContext?: 'always' | 'with_customization' | 'without_customization' | null;
  boxImage?: string | null;
  boxWidthMm?: number | null;
  boxHeightMm?: number | null;
  boxLengthMm?: number | null;
  boxWeightKg?: number | null;
  boxQuantity?: number | null;
  boxVolumeCm3?: number | null;

  stockStatus: 'in-stock' | 'low-stock' | 'out-of-stock';
  featured: boolean;
  newArrival: boolean;
  onSale: boolean;
  isKit: boolean;
  gender?: string | null;
  category: { id: string | number; name: string };
  supplier: { id: string; name: string };
  tags: {
    publicoAlvo: string[];
    datasComemorativas: string[];
    endomarketing: string[];
    ramo: string[];
    nicho: string[];
  };

  subcategory?: string;
  groups?: Array<{ id: number; name: string }>;
  variations?: ProductVariation[];
  kitItems?: KitComponent[];

  priceUpdatedAt?: string | null;
  priceFreshnessThresholdDays?: number | null;
  metadata?: { height_mm?: number | null; width_mm?: number | null; [key: string]: unknown } | null;
  leadTimeDays?: number | null;
  video?: string | null;
  productVideos?: Array<{
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
  }>;
}

export interface KitComponent {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  sku: string;
  imageUrl?: string | null;
  isOptional?: boolean;
  isPackaging?: boolean;
  isReplaceable?: boolean;
  allowsPersonalization?: boolean;
  material?: string | null;
  weightG?: number | null;
  heightMm?: number | null;
  widthMm?: number | null;
  lengthMm?: number | null;
  volumeMl?: number | null;
  componentTypeCode?: string | null;
  supplierComponentCode?: string | null;
  description?: string | null;
  personalizationNotes?: string | null;
  color?: string | null;
  video?: string;
  productVideos?: Array<{
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
  }>;
}

export interface ProductVariation {
  id: string;
  sku: string;
  color: {
    name: string;
    hex: string;
  };
  stock: number;
  image?: string | null;
  images?: string[];
  videos?: Array<{
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
  }>;
  size_code?: string | null;
}

export interface ProductFilters {
  category?: string;
  categoryId?: string | number;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  limit?: number;
}

export interface ProductLightweight {
  id: string;
  name: string;
  sku: string;
  supplier_reference?: string | null;
  price: number;
  image_url: string;
  stock: number;
  brand: string | null;
  category_id: string | null;
  is_active: boolean;
}
