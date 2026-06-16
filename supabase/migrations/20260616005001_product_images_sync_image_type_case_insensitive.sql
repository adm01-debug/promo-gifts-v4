-- ============================================================================
-- REFINAÇÃO (gap fino encontrado em re-validação adversarial)
-- ----------------------------------------------------------------------------
-- No caminho bidirecional de fn_sync_image_type_code, um image_type em case
-- diferente (ex.: 'MAIN', 'Logo') não casava com image_types.code (todos lowercase)
-- e era silenciosamente revertido para a FK — mesma classe de "perda silenciosa"
-- que o Codex apontou, para integrações não-UI que enviem case diferente.
-- Correção: lookup case-insensitive + canonicalização para o code real (lowercase).
-- Seguro: os 18 codes de image_types são lowercase e sem colisão case-insensitive.
-- Verificado: 'MAIN'->'main' (adota), 'LoGo'->'logo', 'XXXX'->reverte p/ FK.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_sync_image_type_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_code text;
  v_id   uuid;
BEGIN
  IF NEW.image_type_id IS DISTINCT FROM OLD.image_type_id THEN
    SELECT code INTO v_code FROM image_types WHERE id = NEW.image_type_id;
    IF v_code IS NOT NULL THEN
      NEW.image_type := v_code;
    END IF;
  ELSIF NEW.image_type IS DISTINCT FROM OLD.image_type THEN
    SELECT id, code INTO v_id, v_code FROM image_types WHERE lower(code) = lower(NEW.image_type);
    IF v_id IS NOT NULL THEN
      NEW.image_type_id := v_id;
      NEW.image_type    := v_code;   -- canonicaliza ('MAIN' -> 'main')
    ELSE
      SELECT code INTO v_code FROM image_types WHERE id = NEW.image_type_id;
      IF v_code IS NOT NULL THEN
        NEW.image_type := v_code;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
