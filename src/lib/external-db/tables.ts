/**
 * @deprecated LEGACY — Listas de tabelas da bridge (descomissionada 2026-05-30).
 *
 * As whitelists agora vivem em rest-native.ts:
 *   - REST_NATIVE_SAFE_TABLES (READ)
 *   - REST_NATIVE_WRITE_TABLES (WRITE)
 *   - TABLE_ALIASES / WRITE_TABLE_ALIASES
 *
 * Este arquivo é mantido apenas para:
 *   1. O tipo ExternalTable (usado por useExternalDatabase.ts)
 *   2. Compatibilidade com re-exports em external-db/index.ts
 *
 * ExternalTable foi migrado para rest-native.ts (concluído). Arquivo mantido apenas para as
 * constantes PRODUCT_TABLES / BRIDGE_ALIASES / PRODUCT_VIEWS usadas como documentação.
 */

// ============================================
// Tabelas REAIS do BD externo (whitelist do bridge)
// ============================================
/** @deprecated Use REST_NATIVE_SAFE_TABLES em rest-native.ts */
export const PRODUCT_TABLES = [
  // Principais
  'products',
  'categories',
  'suppliers',
  'tags',
  // Produto — relacionamento
  'product_images',
  'product_videos',
  'product_variants',
  'product_materials',
  'product_tags',
  'product_categories', // alias legacy → product_category_assignments
  'product_category_assignments', // vínculo N:N produto-categoria
  'product_suppliers', // fontes de fornecimento por produto
  'product_print_areas', // áreas de impressão por produto
  'product_kit_components',
  'product_attributes', // alias legacy → product_properties
  'product_properties', // atributos/propriedades de produto (nome real)
  // Cores
  'color_groups',
  'color_nuances',
  'color_equivalences',
  'color_variations',
  'supplier_colors',
  // Materiais
  'material_groups',
  'material_types',
  'material_variations',
  'supplier_materials',
  // Atributos e definições
  'supplier_attribute_definitions',
  'supplier_product_attributes', // alias legacy → supplier_property_mappings
  'supplier_property_mappings', // mapeamentos de propriedades (nome real)
  'category_attributes',
  // Preços e variações
  'price_lists',
  'variant_cost_tiers',
  'variant_sale_prices',
  'variation_types',
  'variation_values',
  'stock_movements',
  // Estoque e Reposição
  'variant_supplier_sources',
  // Fornecedor — Filiais
  'supplier_branches',
  // Coleções
  'collections',
  'collection_products',
  // Público Alvo / Ramos de Atividade
  'ramo_atividade',
  'ramo_atividade_filho',
  'produto_ramo_atividade',
  // NOTA: business_sectors removida (PGRST205 — não exposta no PostgREST externo)
  // NOTA: mockup_drafts e generated_mockups são tabelas LOCAIS (Lovable Cloud), não do BD externo
  // Técnicas de Gravação — tabelas REAIS
  'tecnicas_gravacao', // catálogo de técnicas (16 técnicas-mãe)
  'print_area_techniques', // 2654 áreas de gravação vinculadas a produtos (SSOT)
  // Sistema de Preços v2
  'tabela_preco_gravacao_oficial', // 54 variantes de preço com configurações
  'tabela_preco_gravacao_oficial_faixa', // 301 faixas de preço
  'organization_markup_customization', // 59 configurações de markup (v5.1)
  'category_area_techniques', // vínculos área×técnica com variante_id
  'tabela_preco_fornecedores_gravacao', // preços de gravação por fornecedor
  // Histórico de preços
  'price_history',
  // Histórico de estoque
  'stock_snapshots',
  'stock_daily_summary',
  // Grupos e relacionamentos de produtos
  'product_groups',
  'product_group_members',
  'product_relationships',
] as const;

// ============================================
// ALIASES do Bridge — NÃO são tabelas reais.
// O external-db-bridge mapeia esses nomes para tabelas reais.
// Mantidos para que o TypeScript aceite código legado.
// ============================================
/** @deprecated Aliases agora vivem em TABLE_ALIASES em rest-native.ts */
export const BRIDGE_ALIASES = [
  'tecnica_gravacao', // → tabela_preco_gravacao_oficial
  'personalization_techniques', // real table (uuid PK, EN cols) — NOT aliased; see rest-native.ts "BUG A"
  'customization_price_tables', // → tabela_preco_fornecedores_gravacao (via bridge alias)
  'customization_price_tiers', // → tabela_preco_gravacao_oficial_faixa
] as const;

// Views e Materialized Views (somente leitura) — do bridge
/** @deprecated Views agora vivem em REST_NATIVE_SAFE_TABLES em rest-native.ts */
export const PRODUCT_VIEWS = [
  // Views de produtos
  'v_products_with_techniques',
  'v_products_with_stock',
  'v_products_with_tags',
  'v_products_min_price',
  'v_products_without_images',
  'v_products_without_videos',
  'v_products_missing_primary_image',
  'v_product_print_areas_complete',
  'v_product_images_cdn',
  'v_product_videos_cdn',
  'v_product_attributes_formatted',
  // Views de kits
  'v_kit_with_components',
  'v_kit_component_print_areas',
  // Views de preços e técnicas
  'v_customization_price_summary',
  'v_variant_pricing_complete',
  'v_technique_stats',
  'v_techniques_stricker_mapping',
  // Views de mídia e sync
  'v_media_stats',
  'v_n8n_sync_summary',
  'v_n8n_sync_errors',
  'v_n8n_sync_success_recent',
  // Materialized views
  'mv_product_compositions',
  'mv_material_group_stats',
  'mv_stock_velocity',
  'mv_product_intelligence',
  // Views de materiais
  'materials_complete',
  'products_with_materials',
  // View especial de categorias
  'categories_tree_visual',
] as const;

// Tabelas de EMPRESAS/CLIENTES — acessadas via crm-db-bridge (não external-db-bridge)
export const COMPANY_TABLES = ['client_contacts', 'organizations', 'companies'] as const;

export type ProductTable = (typeof PRODUCT_TABLES)[number];
export type BridgeAlias = (typeof BRIDGE_ALIASES)[number];
export type ProductView = (typeof PRODUCT_VIEWS)[number];
export type CompanyTable = (typeof COMPANY_TABLES)[number];
export type ExternalTable = BridgeAlias | CompanyTable | ProductTable | ProductView;
