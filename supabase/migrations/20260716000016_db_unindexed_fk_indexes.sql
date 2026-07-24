-- Migration: create indexes for unindexed foreign-key columns
-- Eliminates 27 "unindexed_foreign_keys" Supabase advisor warnings.
-- All indexes use IF NOT EXISTS — safe to run multiple times.
-- CONCURRENTLY cannot be used inside a transaction block; Supabase
-- migrations run inside a transaction, so we use plain CREATE INDEX.
-- This is safe on a fresh/preview DB where no live traffic competes.

-- catalog_analytics
CREATE INDEX IF NOT EXISTS idx_catalog_analytics_user_id
  ON public.catalog_analytics (user_id);

-- file_scan_logs
CREATE INDEX IF NOT EXISTS idx_file_scan_logs_user_id
  ON public.file_scan_logs (user_id);

-- frontend_telemetry
CREATE INDEX IF NOT EXISTS idx_frontend_telemetry_user_id
  ON public.frontend_telemetry (user_id);

-- kit_component_enrichment_raw
CREATE INDEX IF NOT EXISTS idx_kit_comp_enrichment_raw_promoted_component
  ON public.kit_component_enrichment_raw (promoted_component_id);

CREATE INDEX IF NOT EXISTS idx_kit_comp_enrichment_raw_promoted_padronizacao
  ON public.kit_component_enrichment_raw (promoted_padronizacao_id);

-- kit_component_padronizacao
CREATE INDEX IF NOT EXISTS idx_kit_comp_padronizacao_component_type_code
  ON public.kit_component_padronizacao (component_type_code);

CREATE INDEX IF NOT EXISTS idx_kit_comp_padronizacao_pkg_type_code
  ON public.kit_component_padronizacao (pkg_type_code);

CREATE INDEX IF NOT EXISTS idx_kit_comp_padronizacao_raw_id
  ON public.kit_component_padronizacao (raw_id);

-- kit_component_variant_skus
CREATE INDEX IF NOT EXISTS idx_kit_comp_variant_skus_item_color_id
  ON public.kit_component_variant_skus (item_color_id);

-- material_equivalences
CREATE INDEX IF NOT EXISTS idx_material_equivalences_promo_group_id
  ON public.material_equivalences (promo_group_id);

-- order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);

-- product_faqs
CREATE INDEX IF NOT EXISTS idx_product_faqs_category_id
  ON public.product_faqs (category_id);

CREATE INDEX IF NOT EXISTS idx_product_faqs_product_id
  ON public.product_faqs (product_id);

-- product_fiscal
CREATE INDEX IF NOT EXISTS idx_product_fiscal_ncm_id
  ON public.product_fiscal (ncm_id);

-- product_kit_components
CREATE INDEX IF NOT EXISTS idx_product_kit_components_padronizacao_id
  ON public.product_kit_components (padronizacao_id);

-- product_notebook_specs
CREATE INDEX IF NOT EXISTS idx_product_notebook_specs_paper_format_id
  ON public.product_notebook_specs (paper_format_id);

-- product_novelties
CREATE INDEX IF NOT EXISTS idx_product_novelties_created_by
  ON public.product_novelties (created_by);

-- product_similarity_group_members
CREATE INDEX IF NOT EXISTS idx_prod_similarity_grp_members_supplier_id
  ON public.product_similarity_group_members (supplier_id);

-- product_videos
CREATE INDEX IF NOT EXISTS idx_product_videos_video_type_id
  ON public.product_videos (video_type_id);

-- produtos_padronizacao
CREATE INDEX IF NOT EXISTS idx_produtos_padronizacao_sub_brand_id
  ON public.produtos_padronizacao (sub_brand_id);

-- produtos_padronizacao_variantes
CREATE INDEX IF NOT EXISTS idx_produtos_padronizacao_variantes_variant_id
  ON public.produtos_padronizacao_variantes (variant_id);

-- produtos_site_padronizacao
CREATE INDEX IF NOT EXISTS idx_produtos_site_padronizacao_raw_id
  ON public.produtos_site_padronizacao (raw_id);

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id
  ON public.profiles (organization_id);

-- quote_history
CREATE INDEX IF NOT EXISTS idx_quote_history_user_id
  ON public.quote_history (user_id);

-- stock_daily_summary
CREATE INDEX IF NOT EXISTS idx_stock_daily_summary_supplier_branch_id
  ON public.stock_daily_summary (supplier_branch_id);

-- stock_snapshots
CREATE INDEX IF NOT EXISTS idx_stock_snapshots_supplier_branch_id
  ON public.stock_snapshots (supplier_branch_id);

-- variant_supplier_sources
CREATE INDEX IF NOT EXISTS idx_variant_supplier_sources_supplier_branch_id
  ON public.variant_supplier_sources (supplier_branch_id);
