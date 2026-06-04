-- Migration: Compound indexes for critical query patterns
-- Problema: consultas de catálogo (90% do tráfego) fazem full table scan
-- porque os índices existentes são single-column e não cobrem os filtros compostos
-- mais frequentes: (is_active + category_id), (is_active + price), (supplier_id + is_active).
-- Referência: AUDIT_REPORT_20260602.md § Performance P1

-- 1. Consultas por categoria ativa (useProductsByCategory, useCatalogState)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_active_category
  ON public.products (is_active, category_id)
  WHERE is_active = true AND deleted_at IS NULL;

-- 2. Consultas por fornecedor ativo (filtro de fornecedor no catálogo)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_active_supplier
  ON public.products (is_active, supplier_id)
  WHERE is_active = true AND deleted_at IS NULL;

-- 3. Consultas por faixa de preço (filtro de preço no catálogo)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_active_price
  ON public.products (is_active, price)
  WHERE is_active = true AND deleted_at IS NULL;

-- 4. Ordenação por data de criação (grid "mais recentes")
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_active_created_desc
  ON public.products (is_active, created_at DESC)
  WHERE is_active = true AND deleted_at IS NULL;

-- 5. Filtro de soft-delete em catálogo (todos os SELECTs de produto)
-- Já existe idx_products_deleted_at mas não é compound com is_active
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_not_deleted_active
  ON public.products (deleted_at, is_active)
  WHERE deleted_at IS NULL;

-- 6. quotes por status + usuário (dashboard de orçamentos)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quotes_user_status
  ON public.quotes (created_by, status)
  WHERE deleted_at IS NULL;

-- 7. quotes por organização + status (visão de gestor)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quotes_org_status
  ON public.quotes (organization_id, status)
  WHERE deleted_at IS NULL;

-- 8. stock_snapshots: acesso por variante + fornecedor (estoque em tempo real)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_snapshots_variant_supplier
  ON public.stock_snapshots (variant_id, supplier_id)
  WHERE deleted_at IS NULL;

-- 9. order_items por pedido (join crítico em tela de pedido)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);

-- 10. color_variations por grupo (filtro de cores no catálogo)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_color_variations_group
  ON public.color_variations (color_group_id);
