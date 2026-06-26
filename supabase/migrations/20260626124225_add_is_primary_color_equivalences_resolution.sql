-- ============================================================================
-- MELHORIA 1/3 — Resolucao deterministica de cor de fornecedor -> variacao Ouro
-- Camada: PRATA (color_equivalences). Resolve mapeamento ambiguo (1 cor->N variacoes)
-- ANTI-REGRESSAO (Lovable bot): NAO remover a coluna is_primary nem o indice
--   uq_color_equivalences_one_primary. Eles garantem 1 primaria ativa por cor.
-- fix_version: 2026-06-26_color_isprimary
-- ============================================================================

ALTER TABLE color_equivalences
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN color_equivalences.is_primary IS
  'Equivalencia primaria/canonica desta supplier_color. Backfill por precedencia: '
  'match_quality(exact>close>approximate) > confidence_score DESC > internal_code num ASC > id. '
  'Garantido <=1 ativa por supplier_color via uq_color_equivalences_one_primary. '
  'fix_version 2026-06-26 - NAO REMOVER (anti-regressao).';

WITH ranked AS (
  SELECT ce.id,
    ROW_NUMBER() OVER (
      PARTITION BY ce.supplier_color_id
      ORDER BY
        (CASE ce.match_quality WHEN 'exact' THEN 1 WHEN 'close' THEN 2
                               WHEN 'approximate' THEN 3 ELSE 4 END) ASC,
        ce.confidence_score DESC NULLS LAST,
        COALESCE(NULLIF(split_part(cv.internal_code,'.',1),'')::int, 9999) ASC,
        COALESCE(NULLIF(split_part(cv.internal_code,'.',2),'')::int, 9999) ASC,
        ce.id ASC
    ) AS rn
  FROM color_equivalences ce
  JOIN color_variations cv ON cv.id = ce.promo_variation_id
  WHERE ce.is_active
)
UPDATE color_equivalences ce
SET is_primary = true
FROM ranked r
WHERE ce.id = r.id AND r.rn = 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_color_equivalences_one_primary
  ON color_equivalences (supplier_color_id)
  WHERE (is_primary AND is_active);

COMMENT ON INDEX uq_color_equivalences_one_primary IS
  'Garante <=1 equivalencia primaria ATIVA por supplier_color. fix_version 2026-06-26. NAO REMOVER.';

NOTIFY pgrst, 'reload schema';
