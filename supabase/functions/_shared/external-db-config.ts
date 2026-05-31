/**
 * @deprecated Bridge `external-db-bridge` descomissionada (kill-switch OFF desde 2026-05-30).
 * Este arquivo é mantido porque external-db-bridge/index.ts ainda importa dele.
 * Será removido completamente na Fase 4 (descomissão da bridge).
 */
// supabase/functions/_shared/external-db-config.ts
// Table whitelists, permissions, types for external-db-bridge

export type ResourceGroup = 'products' | 'companies' | 'views';
export type Operation = 'select' | 'insert' | 'update' | 'delete' | 'rpc' | 'upsert' | 'batch_insert';

// Whitelist de RPCs permitidas
export const ALLOWED_RPCS = [
  'fn_get_product_print_areas',
  'fn_get_product_print_areas_v2',
  'fn_get_product_customization_options',
  'fn_link_product_print_areas',
  'fn_backfill_product_print_areas',
  'fn_get_customization_price',
  'fn_get_customization_price_v2',
  'fn_find_fornecedor_price_table',
  'get_category_descendants',
] as const;

// Tabelas relacionadas a PRODUTOS (CRUD completo)
export const PRODUCT_TABLES = [
  'products',
  'categories',
  'suppliers',
  'tags',
  'product_images',
  'product_videos',
  'product_variants',
  'product_materials',
  'product_tags',
  'product_categories',
  'product_category_assignments',
  'product_suppliers',
  'product_print_areas',
  'product_kit_components',
  'product_attributes',
  'color_groups',
  'color_nuances',
  'color_equivalences',
  'color_variations',
  'supplier_colors',
  'material_groups',
  'material_types',
  'material_variations',
  'supplier_materials',
  'supplier_attribute_definitions',
  'supplier_product_attributes',
  'category_attributes',
  'price_lists',
  'variant_cost_tiers',
  'variant_sale_prices',
  'variation_types',
  'variation_values',
  'stock_movements',
  'variant_supplier_sources',
  'supplier_branches',
  'collections',
  'collection_products',
  'ramo_atividade',
  'ramo_atividade_filho',
  'produto_ramo_atividade',
  'personalization_techniques',
  'customization_price_tables',
  'customization_price_tiers',
  'tecnicas_gravacao',
  'print_area_techniques',
  'tabela_preco_gravacao_oficial',
  'tabela_preco_gravacao_oficial_faixa',
  'organization_markup_customization',
  'category_area_techniques',
  'tabela_preco_fornecedores_gravacao',
  'price_history',
  'stock_snapshots',
  'stock_daily_summary',
  'product_groups',
  'product_group_members',
  'product_relationships',
] as const;

// Views e Materialized Views (somente leitura)
export const PRODUCT_VIEWS = [
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
  'v_kit_with_components',
  'v_kit_component_print_areas',
  'v_customization_price_summary',
  'v_variant_pricing_complete',
  'v_technique_stats',
  'v_techniques_stricker_mapping',
  'v_media_stats',
  'v_n8n_sync_summary',
  'v_n8n_sync_errors',
  'v_n8n_sync_success_recent',
  'mv_product_compositions',
  'mv_material_group_stats',
  'materials_complete',
  'products_with_materials',
  'categories_tree_visual',
  'mv_stock_velocity',
  'mv_product_intelligence',
] as const;

// Tabelas relacionadas a EMPRESAS/CLIENTES (somente leitura)
export const COMPANY_TABLES = [
  'bitrix_clients',
  'client_contacts',
  'client_notes',
  'organizations',
  'user_organizations',
  'business_sectors',
] as const;

// Tabelas de sistema que NÃO devem ser acessadas
export const SYSTEM_TABLES = [
  'user_roles', 'user_onboarding', 'profiles', 'user_filter_presets',
  'user_favorites', 'user_rewards', 'notification_preferences',
  'notification_templates', 'notifications', 'push_subscriptions',
  'analytics_events', 'audit_log', 'search_queries', 'sync_jobs',
  'feature_flags', 'system_settings', 'payments', 'orders', 'order_items',
  'quotes', 'quote_items', 'quote_versions', 'quote_templates',
  'quote_comments', 'achievements', 'seller_achievements',
  'seller_gamification', 'store_rewards', 'expert_conversations',
  'expert_messages', 'saved_filters', 'geo_allowed_countries',
  'media_sync_log', 'category_sync_log',
] as const;

export type ProductTable = typeof PRODUCT_TABLES[number];
export type ProductView = typeof PRODUCT_VIEWS[number];
export type CompanyTable = typeof COMPANY_TABLES[number];

// Permissões por grupo
export const PERMISSIONS: Record<ResourceGroup, Operation[]> = {
  products: ['select', 'insert', 'update', 'delete', 'upsert', 'batch_insert'],
  companies: ['select'],
  views: ['select'],
};

// Tabelas sensíveis — exigem JWT mesmo para leitura
export const SENSITIVE_TABLES = new Set([
  'variant_supplier_sources',
  'variant_cost_tiers',
  'variant_sale_prices',
  'price_lists',
  'price_history',
  'organization_markup_customization',
  'tabela_preco_fornecedores_gravacao',
  'tabela_preco_gravacao_oficial',
  'tabela_preco_gravacao_oficial_faixa',
  'supplier_branches',
  'stock_snapshots',
  'stock_daily_summary',
  'mv_stock_velocity',
  'mv_product_intelligence',
]);

// Heavy tables for adaptive pagination
export const HEAVY_TABLES = ['products', 'product_images', 'product_variants', 'color_variations', 'product_categories', 'product_category_assignments'];
export const VERY_HEAVY_TABLES = ['products', 'product_images'];

// Tables with non-standard timestamp columns
export const TABLES_WITHOUT_CREATED_AT = [
  'variant_supplier_sources',
  'price_history',
  'collection_products',
  'stock_snapshots',
  'stock_daily_summary',
];
export const TABLES_WITHOUT_UPDATED_AT = [
  'product_tags',
  'produto_ramo_atividade',
  'price_history',
  'collection_products',
  'product_category_assignments',
  'stock_snapshots',
  'stock_daily_summary',
];

export function getResourceGroup(tableName: string): ResourceGroup | null {
  if (PRODUCT_TABLES.includes(tableName as ProductTable)) return 'products';
  if (PRODUCT_VIEWS.includes(tableName as ProductView)) return 'views';
  if (COMPANY_TABLES.includes(tableName as CompanyTable)) return 'companies';
  return null;
}
