-- ============================================================================
-- product_images :: coerência image_type (texto) <-> image_type_id (FK)  (Migration 3/5)
-- ----------------------------------------------------------------------------
-- O classificador (fn_auto_classify_product_image) define ambos no INSERT, mas um
-- UPDATE que altere SOMENTE image_type_id deixaria o texto defasado (drift).
-- Este guard mantém image_type derivado da FK (fonte da verdade), alinhado ao
-- COALESCE(it.code, pi.image_type) usado pela view v_product_images_cdn.
-- Drift medido na introdução = 0; guard é preventivo. Dispara só em UPDATE OF image_type_id.
-- Idempotente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_sync_image_type_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_code text;
BEGIN
  IF NEW.image_type_id IS NOT NULL THEN
    SELECT code INTO v_code FROM image_types WHERE id = NEW.image_type_id;
    IF v_code IS NOT NULL THEN
      NEW.image_type := v_code;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_image_type_code ON public.product_images;
CREATE TRIGGER trg_sync_image_type_code
  BEFORE UPDATE OF image_type_id ON public.product_images
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_image_type_code();
