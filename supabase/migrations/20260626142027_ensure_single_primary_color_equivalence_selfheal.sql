-- ============================================================================
-- MELHORIA 4 — Auto-cura da equivalencia primaria (camada PRATA, color_equivalences)
-- Fecha o gap: ao desativar/rebaixar/excluir a primaria de uma supplier_color que
-- ainda tem equivalencias ativas, uma nova primaria e eleita pela MESMA precedencia
-- do backfill. Invariante: (>=1 ativa) => exatamente 1 primaria ativa.
-- Design robusto: BEFORE per-row (inativa nunca e primaria, so toca NEW -> sem erro
-- "tuple already modified") + AFTER FOR EACH STATEMENT (eleicao 1x no fim) + guarda
-- pg_trigger_depth() anti-recursao. Reassignment de primaria deve ser atomico/set-based.
-- ANTI-REGRESSAO (Lovable bot): NAO remover estas funcoes/triggers nem o search_path.
-- fix_version: 2026-06-26_color_primary_selfheal
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_color_equiv_clear_primary_on_inactive()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  IF NOT NEW.is_active THEN NEW.is_primary := false; END IF;
  RETURN NEW;
END;$fn$;
COMMENT ON FUNCTION fn_color_equiv_clear_primary_on_inactive() IS
  'Garante que equivalencia inativa nunca seja is_primary. fix_version 2026-06-26 - anti-regressao, NAO REMOVER.';

DROP TRIGGER IF EXISTS trg_color_equiv_clear_primary_on_inactive ON color_equivalences;
CREATE TRIGGER trg_color_equiv_clear_primary_on_inactive
  BEFORE INSERT OR UPDATE OF is_primary, is_active ON color_equivalences
  FOR EACH ROW EXECUTE FUNCTION fn_color_equiv_clear_primary_on_inactive();

CREATE OR REPLACE FUNCTION fn_color_equiv_ensure_primary_stmt()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE r record; v_best uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NULL; END IF;  -- anti-recursao
  FOR r IN
    SELECT supplier_color_id AS sc FROM color_equivalences GROUP BY supplier_color_id
    HAVING count(*) FILTER (WHERE is_active) > 0
       AND count(*) FILTER (WHERE is_active AND is_primary) = 0
  LOOP
    SELECT ce.id INTO v_best
    FROM color_equivalences ce JOIN color_variations cv ON cv.id = ce.promo_variation_id
    WHERE ce.supplier_color_id = r.sc AND ce.is_active
    ORDER BY (CASE ce.match_quality WHEN 'exact' THEN 1 WHEN 'close' THEN 2
                                    WHEN 'approximate' THEN 3 ELSE 4 END),
             ce.confidence_score DESC NULLS LAST,
             COALESCE(NULLIF(split_part(cv.internal_code,'.',1),'')::int, 9999),
             COALESCE(NULLIF(split_part(cv.internal_code,'.',2),'')::int, 9999),
             ce.id
    LIMIT 1;
    IF v_best IS NOT NULL THEN
      UPDATE color_equivalences SET is_primary = true WHERE id = v_best;
    END IF;
  END LOOP;
  RETURN NULL;
END;$fn$;
COMMENT ON FUNCTION fn_color_equiv_ensure_primary_stmt() IS
  'Elege a equivalencia primaria (mesma precedencia do backfill) para supplier_colors com >=1 ativa e 0 primaria. fix_version 2026-06-26 - anti-regressao, NAO REMOVER.';

DROP TRIGGER IF EXISTS trg_color_equiv_ensure_primary_stmt ON color_equivalences;
CREATE TRIGGER trg_color_equiv_ensure_primary_stmt
  AFTER INSERT OR DELETE OR UPDATE OF is_primary, is_active, supplier_color_id ON color_equivalences
  FOR EACH STATEMENT EXECUTE FUNCTION fn_color_equiv_ensure_primary_stmt();

-- Reconciliacao defensiva idempotente
UPDATE color_equivalences SET is_primary = false WHERE is_primary AND NOT is_active;
DO $rec$
DECLARE r record; v_best uuid;
BEGIN
  FOR r IN SELECT supplier_color_id AS sc FROM color_equivalences GROUP BY supplier_color_id
           HAVING count(*) FILTER (WHERE is_active)>0 AND count(*) FILTER (WHERE is_active AND is_primary)=0
  LOOP
    SELECT ce.id INTO v_best FROM color_equivalences ce JOIN color_variations cv ON cv.id=ce.promo_variation_id
      WHERE ce.supplier_color_id=r.sc AND ce.is_active
      ORDER BY (CASE ce.match_quality WHEN 'exact' THEN 1 WHEN 'close' THEN 2 WHEN 'approximate' THEN 3 ELSE 4 END),
               ce.confidence_score DESC NULLS LAST,
               COALESCE(NULLIF(split_part(cv.internal_code,'.',1),'')::int,9999),
               COALESCE(NULLIF(split_part(cv.internal_code,'.',2),'')::int,9999), ce.id LIMIT 1;
    IF v_best IS NOT NULL THEN UPDATE color_equivalences SET is_primary=true WHERE id=v_best; END IF;
  END LOOP;
END $rec$;
