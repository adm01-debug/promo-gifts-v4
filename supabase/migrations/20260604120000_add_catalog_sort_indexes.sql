-- Índices para as colunas de ORDENAÇÃO do catálogo de produtos.
--
-- Contexto (auditoria 2026-06-04): o catálogo (view v_products_public sobre
-- public.products) ordena por sale_price (Preço ↑/↓), created_at (Mais Recentes)
-- e stock_quantity (Maior Estoque). Já existem índices para busca
-- (name/sku/description trigram, search_vector) e para category/supplier/brand,
-- mas NÃO para essas colunas de sort — o que força full sort e está alinhado
-- com os statement timeouts observados na paginação defensiva do front
-- (src/lib/external-db/products.ts).
--
-- Índices PARCIAIS (WHERE active = true) para casar com o filtro padrão do
-- catálogo e manter o índice pequeno, no mesmo estilo dos índices já existentes
-- (idx_products_active_name_sort). Em ~6k linhas a criação é instantânea.

CREATE INDEX IF NOT EXISTS idx_products_active_sale_price
  ON public.products (sale_price)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_products_active_created_at
  ON public.products (created_at DESC)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_products_active_stock_quantity
  ON public.products (stock_quantity DESC)
  WHERE active = true;
