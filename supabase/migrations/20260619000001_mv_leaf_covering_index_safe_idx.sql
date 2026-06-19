-- MIGRATION PERMANENTE (2026-06-19): Índices adicionais em mv_product_leaf_category
-- A migration 20260618205528_mv_product_leaf_category_level_first.sql criou apenas:
--   idx_mv_product_leaf_category_product_id (UNIQUE, sem INCLUDE)
--   idx_mv_product_leaf_category_leaf_id    (non-unique)
--
-- Esta migration substitui o UNIQUE simples por um covering index (INCLUDE),
-- e adiciona o safe_idx para leaf_category_id_safe.
--
-- Benefícios:
--   • UNIQUE covering: Index Only Scan no JOIN de v_products_public (zero heap access)
--   • safe_idx: suporte eficiente a buscas por leaf_category_id_safe
--   • Sobrevive a re-deploys: esta migration roda DEPOIS de 20260618205528

-- Substituir UNIQUE simples por covering (se ainda existir sem INCLUDE)
DO $$
DECLARE
  v_cols int;
BEGIN
  SELECT COUNT(*) INTO v_cols
  FROM pg_attribute pa JOIN pg_class c ON c.oid=pa.attrelid
  WHERE c.relname='idx_mv_product_leaf_category_product_id' AND pa.attnum > 0;
  IF v_cols < 6 THEN
    -- Índice simples (sem INCLUDE): substituir pelo covering
    DROP INDEX IF EXISTS idx_mv_product_leaf_category_product_id;
    RAISE NOTICE 'Dropping simple index, will recreate as covering';
  ELSE
    RAISE NOTICE 'Covering index already exists with % cols, skipping drop', v_cols;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_product_leaf_category_product_id
  ON public.mv_product_leaf_category (product_id)
  INCLUDE (leaf_category_id, leaf_category_name, leaf_category_level,
           leaf_category_slug, leaf_category_id_safe);

COMMENT ON INDEX idx_mv_product_leaf_category_product_id IS
'Covering UNIQUE index para Index Only Scan. INCLUDE(leaf_id, name, level, slug, safe).
 Criado/atualizado por 20260619000001_mv_leaf_covering_index_safe_idx.sql';

-- Partial index para buscas por leaf_category_id_safe
CREATE INDEX IF NOT EXISTS idx_mv_product_leaf_category_safe_id
  ON public.mv_product_leaf_category (leaf_category_id_safe)
  WHERE leaf_category_id_safe IS NOT NULL;

COMMENT ON INDEX idx_mv_product_leaf_category_safe_id IS
'Partial index para buscas filtradas por leaf_category_id_safe.
 Criado por 20260619000001_mv_leaf_covering_index_safe_idx.sql';
