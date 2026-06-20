/**
 * Camada OURO (Gold) da arquitetura Medallion — contratos de leitura do frontend.
 *
 * Pipeline (ADR 0007/0008, projeto doufsxqlfjyuvxuezpln):
 *
 *   🟤 Bronze  supplier_products_raw(+_history)            — NUNCA ler no frontend
 *   ⚪ Prata   produtos_padronizacao(_variantes)           — NUNCA ler no frontend
 *   🟡 Ouro    products / product_variants /
 *              variant_supplier_sources + views públicas   — ÚNICA fonte do frontend
 *
 * O frontend lê a camada Ouro preferencialmente via views de segurança
 * (`v_products_public`, `v_suppliers_public`, `v_print_area_techniques_public`),
 * que ocultam colunas sensíveis (custos, credenciais) das tabelas-base.
 *
 * Todas as interfaces abaixo foram verificadas coluna a coluna contra
 * information_schema.columns do projeto doufsxqlfjyuvxuezpln em 2026-06-11.
 * Colunas de views são anuláveis por construção (PostgREST não propaga
 * NOT NULL através de views); `id` é mantido não-nulo por pragmatismo.
 *
 * Este módulo é PURO (sem importar o client) para poder ser usado em testes,
 * scripts e no próprio client sem ciclos de dependência.
 */

/**
 * Aliases de leitura OBRIGATÓRIOS: nome lógico (tabela-base Ouro) → view pública.
 * Fonte única para `postgrest.ts` e `stockFetcher.ts` (rest-native.ts mantém o
 * próprio superconjunto).
 *
 * - `products`: a tabela tem grants por coluna para `anon`
 *   (migration p0_seguranca_02) — `select=*` direto quebra; a view não.
 * - `suppliers`: a tabela NÃO tem grant de SELECT para anon/authenticated
 *   (esconde api_credentials); somente a view é legível.
 *
 * NÃO incluído de propósito: `print_area_techniques` → a tabela-base é legível
 * e gravável por authenticated (wizard admin de gravação lê/edita `unit_cost`,
 * que a view `v_print_area_techniques_public` oculta). O alias dessa relação
 * existe apenas no caminho rest-native (leituras de catálogo), não no dbInvoke.
 */
export const GOLD_READ_ALIASES = {
  products: 'v_products_public',
  suppliers: 'v_suppliers_public',
} as const;

/** Linha da view `v_products_public` (projeção 1:1 de `products`, camada Ouro). */
export interface GoldProductRow {
  id: string;
  name: string | null;
  description: string | null;
  sku: string | null;
  category_id: string | null;
  supplier_id: string | null;
  cost_price: number | null;
  sale_price: number | null;
  stock_quantity: number | null;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  suggested_price: number | null;
  dimensions: unknown;
  images: unknown;
  primary_image_url: string | null;
  videos: unknown;
  allows_personalization: boolean | null;
  colors: unknown;
  materials: unknown;
  tags: unknown;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string[] | null;
  is_featured: boolean | null;
  is_new: boolean | null;
  is_on_sale: boolean | null;
  view_count: number | null;
  favorite_count: number | null;
  order_count: number | null;
  organization_id: string | null;
  product_type: string | null;
  is_active: boolean | null;
  created_by: string | null;
  updated_by: string | null;
  sku_promo: string | null;
  short_description: string | null;
  main_category_id: string | null;
  brand: string | null;
  is_deleted: boolean | null;
  deleted_at: string | null;
  is_kit: boolean | null;
  is_bestseller: boolean | null;
  min_quantity: number | null;
  box_length_mm: number | null;
  box_width_mm: number | null;
  box_height_mm: number | null;
  box_weight_kg: number | null;
  has_colors: boolean | null;
  has_sizes: boolean | null;
  ean: string | null;
  gtin: string | null;
  ncm_code: string | null;
  origin_country: string | null;
  warranty_months: number | null;
  manufacturer_sku: string | null;
  last_stock_update_at: string | null;
  supplier_reference: string | null;
  is_textil: boolean | null;
  has_capacity: boolean | null;
  combined_sizes: string | null;
  gender: string | null;
  is_stockout: boolean | null;
  is_online_exclusive: boolean | null;
  catalog_page: number | null;
  weight_g: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  dimensions_display: string | null;
  box_length_cm: number | null;
  box_width_cm: number | null;
  box_height_cm: number | null;
  box_volume_cm3: number | null;
  box_quantity: number | null;
  box_inner_quantity: number | null;
  packing_type: string | null;
  repacking_type: string | null;
  capacities: string | null;
  last_sync_at: string | null;
  last_sync_supplier_id: string | null;
  sync_status: string | null;
  diameter_cm: number | null;
  shape_type: string | null;
  internal_height_cm: number | null;
  internal_width_cm: number | null;
  internal_length_cm: number | null;
  internal_diameter_cm: number | null;
  packaging_material: string | null;
  packaging_color: string | null;
  has_inner_cradle: boolean | null;
  cradle_material: string | null;
  packaging_finish: string | null;
  is_imported: boolean | null;
  lead_time_days: number | null;
  requires_minimum_order: boolean | null;
  supply_mode: string | null;
  is_thermal: boolean | null;
  capacity_ml: number | null;
  slug: string | null;
  ai_summary: string | null;
  key_benefits: string[] | null;
  use_cases: string[] | null;
  target_audience: string[] | null;
  schema_json: unknown;
  canonical_url: string | null;
  robots_meta: string | null;
  seo_score: number | null;
  seo_last_audit_at: string | null;
  seo_issues: unknown;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  description_packaging_info: unknown;
  has_optional_packaging: boolean | null;
  optional_packaging_ref: string | null;
  packing_classification: string | null;
  ipi_rate: number | null;
  tax_reference_state: string | null;
  engraving_type: string | null;
  supplier_updated_at: string | null;
  has_gift_box: boolean | null;
  min_order_quantity: number | null;
  ai_title: string | null;
  ai_description: string | null;
  ai_version: number | null;
  ai_generated_at: string | null;
  ai_model: string | null;
  box_image: string | null;
  repacking_classification: string | null;
  has_commercial_packaging: boolean | null;
  packaging_context: string | null;
  bitrix_product_id: number | null;
  novelty_detected_at: string | null;
  novelty_expires_at: string | null;
  ncm_id: string | null;
  bitrix_images_synced_at: string | null;
  is_featured_expires_at: string | null;
  is_bestseller_expires_at: string | null;
  is_on_sale_expires_at: string | null;
  is_new_expires_at: string | null;
  supplier_product_url: string | null;
  freight_class: string | null;
  cubic_weight: number | null;
  auto_category: string | null;
  auto_material: string | null;
  classification_confidence: number | null;
  price_updated_at: string | null;
  external_id: string | null;
  price_freshness_threshold_days: number | null;
  set_image_url: string | null;
  is_seasonal: boolean | null;
  pvc_free: boolean | null;
  supplier_type: string | null;
  supplier_subtype: string | null;
  supplier_type_code: string | null;
  supplier_subtype_code: string | null;
  price_verified_at: string | null;
  // ── Campos adicionados em 2026-06-18 (audit-10-10) ─────────────────────────
  // Gerados por mv_product_leaf_category + migração recente da view v_products_public.
  // Campos opcionais (nullable) por construção do PostgREST sobre views.
  primary_image_fallback_url: string | null;
  leaf_category_id: string | null;
  leaf_category_name: string | null;
  leaf_category_level: number | null;
  leaf_category_slug: string | null;
  leaf_category_id_safe: string | null;
  circumference_cm: number | null;
  search_vector: string | null;
}

/** Linha da tabela Ouro `product_variants`. */
export interface GoldVariantRow {
  id: string;
  product_id: string;
  sku: string | null;
  name: string | null;
  attributes: unknown;
  stock_quantity: number | null;
  images: unknown;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  sku_promo: string | null;
  color_id: string | null;
  size_id: string | null;
  supplier_sku: string | null;
  color_code: string | null;
  color_name: string | null;
  color_hex: string | null;
  size_code: string | null;
  capacity_ml: number | null;
  last_sync_at: string | null;
  last_sync_supplier_id: string | null;
  selected_thumbnail: string | null;
  bitrix_product_id: number | null;
  CodigoXbz: string | null;
  size_length_cm: number | null;
  size_width_cm: number | null;
}

/** Linha da tabela Ouro `variant_supplier_sources` (estoque/custo por fornecedor). */
export interface GoldVariantSupplierSourceRow {
  id: string;
  organization_id: string | null;
  variant_id: string | null;
  supplier_id: string | null;
  quantity: number | null;
  source: string | null;
  last_synced_at: string | null;
  sync_status: string | null;
  sync_error: string | null;
  updated_at: string | null;
  next_quantity_1: number | null;
  next_date_1: string | null;
  next_quantity_2: number | null;
  next_date_2: string | null;
  next_quantity_3: number | null;
  next_date_3: string | null;
  supplier_sku: string | null;
  supplier_color_code: string | null;
  supplier_color_name: string | null;
  cost_price: number | null;
  list_price: number | null;
  cost_price_1: number | null;
  min_qty_1: number | null;
  cost_price_2: number | null;
  min_qty_2: number | null;
  cost_price_3: number | null;
  min_qty_3: number | null;
  cost_price_4: number | null;
  min_qty_4: number | null;
  cost_price_5: number | null;
  min_qty_5: number | null;
  lead_time_days: number | null;
  min_order_qty: number | null;
  pack_quantity: number | null;
  sale_multiplier: number | null;
  is_preferred: boolean | null;
  priority: number | null;
  is_active: boolean | null;
  supplier_images: unknown;
  supplier_videos: unknown;
  supplier_thumbnail: string | null;
  removed_from_api: boolean | null;
  removed_at: string | null;
  raw_data: unknown;
  stock_main_warehouse: number | null;
  stock_other_warehouses: number | null;
  supplier_availability_status: string | null;
  supplier_ipi_rate: number | null;
  supplier_branch_id: string | null;
  icms_rate: number | null;
  pis_rate: number | null;
  cofins_rate: number | null;
  cfop: string | null;
  csosn: string | null;
  cest: string | null;
  cst: string | null;
  operation_nature: string | null;
  price_updated_at: string | null;
  next_quantity_4: number | null;
  next_quantity_5: number | null;
  next_quantity_6: number | null;
  next_date_4: string | null;
  next_date_5: string | null;
  next_date_6: string | null;
  your_price: number | null;
}

/** Linha da view `v_variant_sale_prices_public` (faixas de preço de venda). */
export interface GoldVariantSalePricesRow {
  variant_id: string;
  product_id: string | null;
  sku: string | null;
  color_name: string | null;
  min_qty_1: number | null;
  sale_price_1: number | null;
  min_qty_2: number | null;
  sale_price_2: number | null;
  min_qty_3: number | null;
  sale_price_3: number | null;
  min_qty_4: number | null;
  sale_price_4: number | null;
  min_qty_5: number | null;
  sale_price_5: number | null;
}

/** Linha da view `v_product_images_cdn` (mídia servida pela CDN Cloudflare). */
export interface GoldProductImageCdnRow {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  color_id: string | null;
  cloudflare_image_id: string | null;
  url_cdn: string | null;
  url_base: string | null;
  url_public: string | null;
  url_thumbnail: string | null;
  url_small: string | null;
  url_medium: string | null;
  url_large: string | null;
  filename: string | null;
  file_size_bytes: number | null;
  width_px: number | null;
  height_px: number | null;
  format: string | null;
  image_type: string | null;
  image_type_name: string | null;
  image_type_category: string | null;
  display_priority: number | null;
  gallery_order: number | null;
  show_in_gallery: boolean | null;
  show_in_simulator: boolean | null;
  is_color_specific: boolean | null;
  is_primary_candidate: boolean | null;
  is_primary: boolean | null;
  display_order: number | null;
  applies_to_color: boolean | null;
  has_color: boolean | null;
  supplier_code: string | null;
  source_supplier: string | null;
  url_original: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  product_name: string | null;
  product_sku: string | null;
}

/** Linha da view `v_products_min_price` (menor/maior preço por produto). */
export interface GoldProductMinPriceRow {
  product_id: string;
  name: string | null;
  sku: string | null;
  min_price: number | null;
  max_price: number | null;
  variants_count: number | null;
}

/** Linha da view `v_print_area_techniques_public` (áreas de gravação sem custo). */
export interface GoldPrintAreaTechniqueRow {
  id: string;
  product_id: string | null;
  tabela_preco_id: string | null;
  location_code: string | null;
  location_name: string | null;
  max_width: number | null;
  max_height: number | null;
  is_curved: boolean | null;
  shape: string | null;
  technique_order: number | null;
  location_order: number | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Linha da view `v_suppliers_public` (fornecedores sem api_credentials). */
export interface GoldSupplierRow {
  id: string;
  name: string | null;
  code: string | null;
  trading_name: string | null;
  logo_url: string | null;
  website: string | null;
  active: boolean | null;
  is_product_supplier: boolean | null;
  is_engraving_supplier: boolean | null;
  state_uf: string | null;
}

/** Linha da view de observabilidade `vw_medallion_coverage` (cobertura por camada). */
export interface MedallionCoverageRow {
  fornecedor: string | null;
  camada: string | null;
  produtos: number | null;
  ncm_pct: number | null;
  materials_pct: number | null;
  tags_pct: number | null;
  meta_pct: number | null;
  ipi_pct: number | null;
  description_pct: number | null;
  category_pct: number | null;
  display_name_pct: number | null;
}

/** Linha da view de observabilidade `v_pipeline_progress` (progresso por fase). */
export interface PipelineProgressRow {
  fase: string | null;
  total_etapas: number | null;
  concluidas: number | null;
  em_andamento: number | null;
  com_erro: number | null;
  pendentes: number | null;
  puladas: number | null;
  pct_completo: number | null;
}

/**
 * Mapa relação Ouro → tipo da linha. As chaves são os nomes FÍSICOS expostos
 * pelo PostgREST (views públicas e tabelas Ouro com grant de leitura).
 */
export interface GoldRowMap {
  v_products_public: GoldProductRow;
  v_suppliers_public: GoldSupplierRow;
  v_print_area_techniques_public: GoldPrintAreaTechniqueRow;
  v_variant_sale_prices_public: GoldVariantSalePricesRow;
  v_product_images_cdn: GoldProductImageCdnRow;
  v_products_min_price: GoldProductMinPriceRow;
  product_variants: GoldVariantRow;
  variant_supplier_sources: GoldVariantSupplierSourceRow;
  vw_medallion_coverage: MedallionCoverageRow;
  v_pipeline_progress: PipelineProgressRow;
}

export type GoldRelationName = keyof GoldRowMap;

/** Lista física das relações Ouro legíveis (para contract tests e auditoria). */
export const GOLD_RELATIONS = [
  'v_products_public',
  'v_suppliers_public',
  'v_print_area_techniques_public',
  'v_variant_sale_prices_public',
  'v_product_images_cdn',
  'v_products_min_price',
  'product_variants',
  'variant_supplier_sources',
  'vw_medallion_coverage',
  'v_pipeline_progress',
] as const satisfies readonly GoldRelationName[];
