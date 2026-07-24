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
-- The catalog price column is sale_price (not a generic 'price'); base_price is deprecated.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_active_price
  ON public.products (is_active, sale_price)
  WHERE is_active = true AND deleted_at IS NULL;

-- 4. Ordenação por data de criação (grid "mais recentes")
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_active_created_desc
  ON public.products (is_active, created_at DESC)
  WHERE is_active = true AND deleted_at IS NULL;

-- 5. Filtro de soft-delete em catálogo (todos os SELECTs de produto)
-- deleted_at não é incluído nas colunas: o predicado WHERE deleted_at IS NULL
-- já o fixa em NULL, tornando-o constante e sem benefício como coluna indexada.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_not_deleted_active
  ON public.products (is_active)
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
-- No deleted_at column on stock_snapshots — purged by captured_at, not soft-deleted.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_snapshots_variant_supplier
  ON public.stock_snapshots (variant_id, supplier_id);

-- 9. order_items por pedido (join crítico em tela de pedido)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);

-- 10. color_variations por grupo — já coberto por idx_color_variations_color_group_id
-- criado em 20260602_001_add_fk_indexes_critical.sql; índice redundante removido.
