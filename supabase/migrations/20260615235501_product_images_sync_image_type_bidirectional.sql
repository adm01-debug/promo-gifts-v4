-- ============================================================================
-- FIX (review Codex P2 #1, regressão real introduzida no guard close_drift)
-- ----------------------------------------------------------------------------
-- O guard anterior, ao disparar em UPDATE OF image_type, REVERTIA o texto a partir
-- da FK. Mas a UI do admin (useProductImageGallery.updateExternalImageMeta, ~L184)
-- altera o TIPO setando apenas image_type (texto), sem image_type_id — então o save
-- "tinha sucesso" mas não mudava a classificação (perda silenciosa).
--
-- Correção: torna fn_sync_image_type_code BIDIRECIONAL, honrando a intenção:
--   - image_type_id mudou           -> texto segue o id (FK explícita vence)
--   - apenas image_type (texto) mudou -> mapeia o texto de volta p/ o id (adota o
--     novo tipo). Texto sem code válido é revertido p/ a FK atual (sem drift, sem
--     aceitar tipo inexistente).
-- Verificado: texto->'logo' adota (texto+id=logo); texto->'XXXX' reverte; id->set propaga.
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
    SELECT id INTO v_id FROM image_types WHERE code = NEW.image_type;
    IF v_id IS NOT NULL THEN
      NEW.image_type_id := v_id;
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
