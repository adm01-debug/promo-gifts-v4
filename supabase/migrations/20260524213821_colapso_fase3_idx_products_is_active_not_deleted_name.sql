-- =============================================================
-- FASE 3 — Índice parcial para a query de listagem pública mais
-- pesada (1654ms × 18 calls + 313ms × 8971 calls = ~2840s/dia total).
--
-- Query origem (via PostgREST):
--   SELECT ... FROM products
--   WHERE is_active = true AND is_deleted = false
--   ORDER BY name ASC
--   LIMIT N OFFSET M
--
-- O índice existente idx_products_active_name_sort está em (name)
-- WHERE active=true. Nota: products tem duas colunas distintas:
-- `active` e `is_active`. A query nova usa is_active, então o índice
-- atual NÃO COBRE essa query.
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_products_is_active_not_deleted_name
  ON public.products (name)
  WHERE is_active = true AND is_deleted = false;

COMMENT ON INDEX public.idx_products_is_active_not_deleted_name IS
'Índice parcial para listagem pública (PostgREST). Criado em 2026-05-24 fase 3.
Cobre WHERE is_active=true AND is_deleted=false ORDER BY name.';
