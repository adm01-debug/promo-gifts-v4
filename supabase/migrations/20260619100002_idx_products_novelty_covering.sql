-- Performance: índice cobrindo para queries de novidades com novelty_expires_at
--
-- Problema (auditoria Novidades 2026-06-19):
-- O índice idx_products_new_sort existente cobre (novelty_detected_at DESC, id ASC)
-- com WHERE is_new = true, mas não inclui novelty_expires_at na condição nem nas
-- colunas cobertas. A query do hook useNoveltiesWithDetails filtra por
-- `novelty_expires_at > NOW()`, forçando uma verificação de heap para cada linha
-- encontrada pelo índice — O(n) heap fetches onde n = total de is_new = true.
--
-- Correção:
-- Cria índice parcial que inclui novelty_expires_at na predicado e nas colunas
-- para eliminar heap fetches no filtro de expiração, tornando a query index-only.

-- Remove versão anterior se existir (evita conflito de nome)
DROP INDEX IF EXISTS idx_products_new_active_sort;

CREATE INDEX idx_products_new_active_sort
  ON products (novelty_detected_at DESC, id ASC)
  INCLUDE (novelty_expires_at, sale_price, stock_quantity, is_stockout, primary_image_url, category_id, supplier_id)
  WHERE is_new = true;

COMMENT ON INDEX idx_products_new_active_sort IS
  'Índice cobrindo para queries de novidades ativas. '
  'Predicate: is_new=true. Include: colunas lidas por useNoveltiesWithDetails. '
  'Evita heap fetch para filtro novelty_expires_at > NOW() e filtros de qualidade.';
