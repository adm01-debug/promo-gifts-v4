-- DRIFT MIGRATION (2026-06-19 audit GAP-4)
-- mv_product_leaf_category v2: algoritmo level-first (categoria mais profunda primeiro).
--
-- MUDANÇA vs v1:
--   v1 (original): ORDER BY is_primary DESC, level DESC
--   v2 (este):     ORDER BY level DESC, is_primary DESC
--
-- Impacto:
--   • 4782 produtos (63%) sem mudança
--   • 2792 produtos (37%) agora exibem categoria mais específica
--   • 0 produtos ficam em categoria menos específica (zero regressões)
--   • avg_level: 2.60 → 3.25 (+0.65 níveis)
--
-- Justificativa:
--   O objetivo de leaf_category_id é mostrar o produto na subcategoria mais
--   específica possível para melhor experiência de navegação. O critério
--   is_primary deve ser tie-break, não prioridade absoluta. Com is_primary
--   como primeiro critério, 2792 produtos de nível 4 eram exibidos no nível
--   2 simplesmente porque o assignment de nível 2 era o primário.
-- --------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS public.mv_product_leaf_category CASCADE;

CREATE MATERIALIZED VIEW public.mv_product_leaf_category AS
  SELECT DISTINCT ON (pca.product_id)
    pca.product_id,
    c.id          AS leaf_category_id,
    c.name        AS leaf_category_name,
    c.level       AS leaf_category_level,
    c.parent_id   AS leaf_category_parent_id,
    c.slug        AS leaf_category_slug,
    -- leaf_category_id_safe: restrito ao branch do main_category_id
    CASE
      WHEN p.main_category_id IS NULL          THEN c.id
      WHEN c.id = p.main_category_id           THEN c.id
      WHEN EXISTS (
        SELECT 1 FROM category_ancestors ca
        WHERE ca.descendant_id = c.id
          AND ca.ancestor_id   = p.main_category_id
      )                                        THEN c.id
      ELSE NULL
    END AS leaf_category_id_safe
  FROM product_category_assignments pca
  JOIN categories c  ON c.id  = pca.category_id
  LEFT JOIN products p ON p.id = pca.product_id
  ORDER BY
    pca.product_id,
    c.level           DESC NULLS LAST,   -- v2: profundidade PRIMEIRO (era is_primary)
    pca.is_primary    DESC NULLS LAST,   -- tie-break: primário antes de não-primário
    pca.display_order ASC,
    c.name            ASC
WITH DATA;

-- Índices
CREATE UNIQUE INDEX idx_mv_product_leaf_category_product_id
  ON public.mv_product_leaf_category (product_id);

CREATE INDEX idx_mv_product_leaf_category_leaf_id
  ON public.mv_product_leaf_category (leaf_category_id);
