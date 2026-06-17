/**
 * Tipos/interfaces para o banco de dados externo de produtos.
 * Extraído de useExternalDatabase.ts para modularização.
 */

export interface ExternalProduct {
  id: string;
  organization_id?: string;
  name: string;
  sku?: string;
  description?: string;
  short_description?: string;
  price?: number;
  /** Alguns bridges expõem o preço de venda como sale_price em vez de price. */
  sale_price?: number;
  cost_price?: number;
  category_id?: string;
  subcategory_id?: string;
  supplier_id?: string;
  brand?: string;
  model?: string;
  weight_grams?: number;
  width_cm?: number;
  height_cm?: number;
  depth_cm?: number;
  is_active?: boolean;
  is_kit?: boolean;
  min_quantity?: number;
  stock?: number;
  // Colunas reais do products no CRM (sem alias no rest-native):
  // unit_price/stock_qty são o que o PostgREST devolve de fato.
  unit_price?: number;
  stock_qty?: number;
  margin_pct?: number;
  min_stock?: number;
  category?: string;
  lead_time_days?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

export interface ExternalProductImage {
  id: string;
  product_id: string;
  variant_id?: string;
  color_id?: string;
  url?: string;
  url_cdn?: string;
  url_original?: string;
  filename?: string;
  cloudflare_image_id?: string;
  image_type?: string;
  image_type_id?: string;
  is_primary?: boolean;
  is_og_image?: boolean;
  applies_to_color?: boolean;
  display_order?: number;
  alt_text?: string;
  title_text?: string;
  source_supplier?: string;
  supplier_code?: string;
  width_px?: number;
  height_px?: number;
  file_size_bytes?: number;
  format?: string;
  caption?: string;
  position?: number;
  is_active?: boolean;
  organization_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ExternalProductVariant {
  id: string;
  product_id: string;
  sku?: string;
  supplier_sku?: string;
  sku_promo?: string;
  web_sku?: string;
  CodigoXbz?: string;
  name?: string;
  color_name?: string;
  color_hex?: string;
  color_id?: string;
  color_code?: string;
  size_code?: string;
  size_id?: string;
  stock_quantity?: number;
  ean?: string;
  attributes?: Record<string, unknown>;
  capacity?: string;
  capacity_ml?: number;
  capacity_display?: string;
  height_mm?: number;
  width_mm?: number;
  length_mm?: number;
  width_cm?: number;
  length_cm?: number;
  weight_g?: number;
  images?: unknown[];

  selected_thumbnail?: string;
  selected_videos?: unknown[];
  bitrix_product_id?: number;
  last_sync_at?: string;
  is_active?: boolean;
  organization_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ExternalProductKitComponent {
  id: string;
  kit_product_id: string;
  component_name?: string;
  component_description?: string;
  component_type_code?: string;
  component_code?: string;
  component_product_id?: string;
  component_sku?: string;
  quantity?: number;
  display_order?: number;
  is_optional?: boolean;
  is_packaging?: boolean;
  is_replaceable?: boolean;
  allows_personalization?: boolean;
  personalization_notes?: string;
  material?: string;
  material_type_id?: string;
  secondary_material_type_id?: string;
  color?: string;
  primary_image_url?: string;
  primary_image_fallback_url?: string | null;
  images?: unknown[];
  allowed_variant_ids?: string[];
  supplier_component_code?: string;
  height_mm?: number;
  width_mm?: number;
  length_mm?: number;
  weight_g?: number;
  notes?: string;
  is_active?: boolean;
  organization_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ExternalProductMaterial {
  id: string;
  product_id: string;
  material_id: string;
  part?: string;
  percentage?: number;
  sort_order?: number;
  notes?: string;
  is_active?: boolean;
  organization_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ExternalCategory {
  id: string;
  bitrix_id?: string;
  name: string;
  slug?: string;
  description?: string;
  parent_id?: string;
  level?: number;
  position?: number;
  image_url?: string;
  is_active?: boolean;
  created_at?: string;
}

export interface ExternalSupplier {
  id: string;
  name: string;
  code?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  website?: string;
  lead_time_days?: number;
  is_active?: boolean;
  default_markup_percent?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface ExternalSupplierColor {
  id: string;
  supplier_id: string;
  color_name: string;
  color_code?: string;
  hex_code?: string;
  pantone_code?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ExternalSupplierMaterial {
  id: string;
  supplier_id: string;
  material_name: string;
  material_code?: string;
  description?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ExternalSupplierAttributeDefinition {
  id: string;
  supplier_id?: string;
  attribute_name: string;
  attribute_code?: string;
  attribute_type?: string;
  possible_values?: string[];
  is_required?: boolean;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ExternalSupplierProductAttribute {
  id: string;
  product_id: string;
  supplier_id?: string;
  attribute_definition_id?: string;
  attribute_name: string;
  attribute_value: string;
  created_at?: string;
  updated_at?: string;
}

export interface ExternalProductSupplier {
  id: string;
  product_id: string;
  supplier_id: string;
  supplier_sku?: string;
  cost_price?: number;
  lead_time_days?: number;
  min_quantity?: number;
  is_primary?: boolean;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ExternalTechnique {
  id: string;
  name: string;
  code?: string;
  description?: string;
  min_quantity?: number;
  setup_cost?: number;
  estimated_days?: number;
  is_active?: boolean;
  created_at?: string;
}

export interface ExternalPriceTable {
  id: string;
  organization_id?: string;
  table_code: string;
  table_code_option?: string;
  technique_id?: string;
  max_area_width_cm?: number;
  max_area_height_cm?: number;
  max_colors?: number;
  price_by_color?: boolean;
  price_by_area?: boolean;
  setup_price?: number;
  is_active?: boolean;
  created_at?: string;
}

export interface ExternalCollection {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  image_url?: string;
  is_active?: boolean;
  created_at?: string;
}

export interface ExternalTag {
  id: string;
  name: string;
  slug?: string;
  color?: string;
  created_at?: string;
}

export interface ExternalCompany {
  id: string;
  bitrix_id?: string;
  name: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  cep?: string;
  ramo?: string;
  nicho?: string;
  logo_url?: string;
  primary_color_hex?: string;
  total_spent?: number;
  last_purchase_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ExternalClientContact {
  id: string;
  client_id: string;
  name: string;
  email?: string;
  phone?: string;
  position?: string;
  is_primary?: boolean;
  created_at?: string;
}

export interface ExternalOrganization {
  id: string;
  name: string;
  slug?: string;
  logo_url?: string;
  is_active?: boolean;
  created_at?: string;
}

export interface ExternalRamoAtividade {
  id: string;
  nome: string;
  slug?: string;
  descricao?: string;
  icone?: string;
  cor?: string;
  ativo?: boolean;
  ordem?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ExternalRamoAtividadeFilho {
  id: string;
  ramo_atividade_id: string;
  nome: string;
  slug?: string;
  descricao?: string;
  icone?: string;
  ativo?: boolean;
  ordem?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ExternalBusinessSector {
  id: string;
  organization_id?: string;
  name: string;
  slug?: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ExternalMaterialGroup {
  id: string;
  organization_id?: string;
  name: string;
  slug?: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ExternalMaterialType {
  id: string;
  organization_id?: string;
  group_id: string;
  name: string;
  slug?: string;
  description?: string;
  properties?: Record<string, unknown>;
  display_order?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ExternalColorGroup {
  id: string;
  organization_id?: string;
  name: string;
  slug?: string;
  hex_code?: string;
  description?: string;
  internal_code?: string;
  sort_order?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ExternalColorVariation {
  id: string;
  organization_id?: string;
  group_id: string;
  color_group_id?: string;
  nuance_id?: string;
  name: string;
  slug?: string;
  hex_code?: string;
  image_url?: string;
  description?: string;
  internal_code?: string;
  sort_order?: number;
  is_active?: boolean;
  is_available?: boolean;
  created_at?: string;
  updated_at?: string;
}
