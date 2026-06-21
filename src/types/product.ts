// src/types/product.ts
// Produto do catálogo

export interface Product {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  shortDescription: string;
  price: number;
  sale_price?: number;
  stock: number | null;
  stock_status: string | null;
  category_id: number | null;
  category_name: string | null;
  subcategory: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  image_url?: string | null; // Primary image (convenience, = images[0])
  og_image_url?: string | null; // OG image for social sharing
  category?: ProductCategoryRef | null; // Objeto aninhado (join com categories)
  supplier?: ProductSupplierRef | null; // Objeto aninhado (join com suppliers)
  images: string[] | null; // Array de URLs
  colors: ProductColor[] | null; // JSONB array
  materials: string[] | null; // JSONB array
  variations: ProductVariation[] | null; // JSONB array
  tags: Record<string, unknown> | null; // JSONB
  featured: boolean | null;
  new_arrival: boolean | null;
  on_sale: boolean | null;
  is_kit: boolean | null;
  kit_items: KitItem[] | null; // JSONB array
  is_active: boolean | null;
  min_quantity: number | null;
  external_id: string | null;
  metadata: ProductMetadata | null; // JSONB
  dimensions?: {
    height_cm?: number | null;
    width_cm?: number | null;
    length_cm?: number | null;
    diameter_cm?: number | null;
    weight_g?: number | null;
    capacity_ml?: number | null;
  } | null;
  video_url: string | null;
  search_vector: unknown; // tsvector (ignorar no frontend)
  created_at: string;
  updated_at: string;
  synced_at: string;
}

export interface ProductCategoryRef {
  id?: number | string;
  name?: string;
  icon?: string;
}

export interface ProductSupplierRef {
  id?: string;
  name?: string;
  verified?: boolean;
  isVerified?: boolean;
}

export interface ProductColor {
  name: string;
  hex?: string;
  code?: string;
  image?: string; // Imagem principal da cor (retrocompatibilidade)
  images?: string[]; // Múltiplas fotos por cor
  videos?: string[]; // Vídeos por cor
  stock?: number;
}

export interface ProductVariation {
  id?: string;
  name: string;
  sku?: string;
  price?: number;
  stock?: number;
  attributes?: Record<string, string>;
  color?: ProductColor; // Cor da variação
  image?: string; // Imagem principal da variação
  images?: string[]; // Múltiplas fotos da variação
  videos?: string[]; // Vídeos da variação
}

export interface KitItem {
  product_id: string;
  product_name: string;
  quantity: number;
}

export interface ProductMetadata {
  width_mm?: number;
  height_mm?: number;
  depth_mm?: number;
  weight_g?: number;
  min_quantity?: number;
  max_quantity?: number;
  lead_time_days?: number;
  [key: string]: unknown;
}

// Filtros de busca
export interface ProductFilters {
  search?: string;
  category_id?: number | string;
  category_name?: string;
  subcategory?: string;
  supplier_id?: string;
  featured?: boolean;
  new_arrival?: boolean;
  on_sale?: boolean;
  is_kit?: boolean;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}

// Produto simplificado para listagens
export type ProductListItem = Pick<
  Product,
  | 'category_name'
  | 'colors'
  | 'featured'
  | 'id'
  | 'images'
  | 'name'
  | 'new_arrival'
  | 'price'
  | 'sku'
  | 'stock_status'
>;
