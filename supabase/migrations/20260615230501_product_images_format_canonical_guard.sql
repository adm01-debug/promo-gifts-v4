-- ============================================================================
-- product_images :: blindagem do campo `format`  (Migration 1/5)
-- ----------------------------------------------------------------------------
-- Contexto: o campo `format` convivia com casing inconsistente (JPEG/jpg/PNG).
-- Um job de ingestão autoritativo já normaliza valores em runtime; esta migration
-- adiciona a GUARDA de escrita + o INVARIANTE de minúsculo, sem enumerar formatos
-- (não quebra avif/jxl futuros nem o job vivo).
-- Idempotente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_normalize_image_format()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.format IS NOT NULL THEN
    NEW.format := lower(btrim(NEW.format));
    -- canonicaliza a variação mais comum
    IF NEW.format = 'jpg'  THEN NEW.format := 'jpeg'; END IF;
    -- remove eventual prefixo mime ("image/png" -> "png")
    IF position('/' in NEW.format) > 0 THEN
      NEW.format := split_part(NEW.format, '/', 2);
    END IF;
    IF NEW.format = '' THEN NEW.format := NULL; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_image_format ON public.product_images;
CREATE TRIGGER trg_normalize_image_format
  BEFORE INSERT OR UPDATE OF format ON public.product_images
  FOR EACH ROW EXECUTE FUNCTION public.fn_normalize_image_format();

-- CHECK do invariante (lowercase alfanumérico). NOT VALID + VALIDATE = online.
ALTER TABLE public.product_images
  DROP CONSTRAINT IF EXISTS chk_product_images_format_lc;
ALTER TABLE public.product_images
  ADD CONSTRAINT chk_product_images_format_lc
  CHECK (format IS NULL OR format ~ '^[a-z0-9]+$') NOT VALID;
ALTER TABLE public.product_images
  VALIDATE CONSTRAINT chk_product_images_format_lc;
