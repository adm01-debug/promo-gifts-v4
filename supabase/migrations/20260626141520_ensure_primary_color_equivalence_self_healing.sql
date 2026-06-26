-- ============================================================================
-- MELHORIA 4 — Auto-cura da equivalencia primaria (fecha o gap A6 da auditoria)
-- Camada: PRATA. Garante que is_primary = SEMPRE a melhor equivalencia ATIVA por
-- supplier_color (precedencia: exact>close>approximate > confidence DESC > internal_code).
-- Re-deriva em INSERT/DELETE/UPDATE relevante: rebaixa primarias erradas/inativas
-- ANTES de promover a melhor (sem estado transitorio de 2 primarias) + guarda
-- pg_trigger_depth() anti-recursao. Complementa o indice uq_color_equivalences_one_primary.
-- Reatribuicao = ajustar match_quality/confidence (o trigger re-deriva); is_primary
-- nao deve ser fixado manualmente (sera sobrescrito pela precedencia).
-- ANTI-REGRESSAO (Lovable bot): NAO remover fn_color_equiv_ensure_primary nem o trigger.
-- fix_version: 2026-06-26_color_primary_selfheal
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_color_equiv_ensure_primary()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public           -- anti-regressao: NAO remover search_path
AS $fn$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NULL; END IF;  -- evita recursao das proprias updates

  -- 1) rebaixa primarias ATIVAS que nao sao a melhor (ANTES de promover -> nunca 2 primarias)
  WITH best AS (
    SELECT DISTINCT ON (ce.supplier_color_id) ce.supplier_color_id AS sc, ce.id AS best_id
    FROM color_equivalences ce JOIN color_variations cv ON cv.id=ce.promo_variation_id
    WHERE ce.is_active
    ORDER BY ce.supplier_color_id,
             (CASE ce.match_quality WHEN 'exact' THEN 1 WHEN 'close' THEN 2 WHEN 'approximate' THEN 3 ELSE 4 END),
             ce.confidence_score DESC NULLS LAST,
             COALESCE(NULLIF(split_part(cv.internal_code,'.',1),'')::int,9999),
             COALESCE(NULLIF(split_part(cv.internal_code,'.',2),'')::int,9999), ce.id
  )
  UPDATE color_equivalences ce SET is_primary=false
  FROM best WHERE ce.supplier_color_id=best.sc AND ce.is_active AND ce.is_primary AND ce.id<>best.best_id;

  -- 2) higiene: linha inativa nunca permanece primaria
  UPDATE color_equivalences SET is_primary=false WHERE is_primary AND NOT is_active;

  -- 3) promove a melhor onde ainda nao e primaria
  UPDATE color_equivalences ce SET is_primary=true
  FROM (
    SELECT DISTINCT ON (ce.supplier_color_id) ce.id AS best_id
    FROM color_equivalences ce JOIN color_variations cv ON cv.id=ce.promo_variation_id
    WHERE ce.is_active
    ORDER BY ce.supplier_color_id,
             (CASE ce.match_quality WHEN 'exact' THEN 1 WHEN 'close' THEN 2 WHEN 'approximate' THEN 3 ELSE 4 END),
             ce.confidence_score DESC NULLS LAST,
             COALESCE(NULLIF(split_part(cv.internal_code,'.',1),'')::int,9999),
             COALESCE(NULLIF(split_part(cv.internal_code,'.',2),'')::int,9999), ce.id
  ) b WHERE ce.id=b.best_id AND NOT ce.is_primary;

  RETURN NULL;
END;
$fn$;

COMMENT ON FUNCTION fn_color_equiv_ensure_primary() IS
  'Mantem is_primary = melhor equivalencia ativa por supplier_color (auto-cura). '
  'fix_version 2026-06-26 - anti-regressao, NAO REMOVER.';

DROP TRIGGER IF EXISTS trg_color_equiv_ensure_primary ON color_equivalences;
CREATE TRIGGER trg_color_equiv_ensure_primary
  AFTER INSERT OR DELETE OR UPDATE OF is_primary, is_active, match_quality, confidence_score, supplier_color_id, promo_variation_id
  ON color_equivalences
  FOR EACH STATEMENT EXECUTE FUNCTION fn_color_equiv_ensure_primary();

NOTIFY pgrst, 'reload schema';
