-- ============================================================================
-- MELHORIA 2/3 — Elimina debito da dupla FK em color_variations (camada OURO)
-- group_id (legado, NOT NULL) e color_group_id (canonico) sao espelhados por
-- trigger BEFORE: preenche o que falta, propaga update de coluna unica e BLOQUEIA
-- divergencia genuina. color_group_id passa a NOT NULL.
-- ANTI-REGRESSAO (Lovable bot): NAO remover fn_sync_color_variation_group nem o
--   trigger trg_sync_color_variation_group; NAO reverter color_group_id p/ NULLABLE.
-- fix_version: 2026-06-26_color_dualfk_sync
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_sync_color_variation_group()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public           -- anti-regressao: NAO remover search_path
AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.color_group_id IS DISTINCT FROM OLD.color_group_id
       AND NEW.group_id IS NOT DISTINCT FROM OLD.group_id THEN
      NEW.group_id := NEW.color_group_id;           -- canonico mudou -> espelha legado
    ELSIF NEW.group_id IS DISTINCT FROM OLD.group_id
       AND NEW.color_group_id IS NOT DISTINCT FROM OLD.color_group_id THEN
      NEW.color_group_id := NEW.group_id;           -- legado mudou -> espelha canonico
    END IF;
  END IF;
  IF NEW.color_group_id IS NULL AND NEW.group_id IS NOT NULL THEN
    NEW.color_group_id := NEW.group_id;
  ELSIF NEW.group_id IS NULL AND NEW.color_group_id IS NOT NULL THEN
    NEW.group_id := NEW.color_group_id;
  ELSIF NEW.group_id IS NOT NULL AND NEW.color_group_id IS NOT NULL
        AND NEW.group_id <> NEW.color_group_id THEN
    RAISE EXCEPTION 'color_variations: group_id(%) <> color_group_id(%) — divergencia bloqueada (fn_sync_color_variation_group)',
      NEW.group_id, NEW.color_group_id;
  END IF;
  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION fn_sync_color_variation_group() IS
  'Mantem group_id (legado) e color_group_id (canonico) sempre identicos em color_variations. '
  'fix_version 2026-06-26 - anti-regressao, NAO REMOVER.';

DROP TRIGGER IF EXISTS trg_sync_color_variation_group ON color_variations;
CREATE TRIGGER trg_sync_color_variation_group
  BEFORE INSERT OR UPDATE OF group_id, color_group_id ON color_variations
  FOR EACH ROW EXECUTE FUNCTION fn_sync_color_variation_group();

ALTER TABLE color_variations ALTER COLUMN color_group_id SET NOT NULL;

NOTIFY pgrst, 'reload schema';
