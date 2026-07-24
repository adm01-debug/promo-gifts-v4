
-- ════════════════════════════════════════════════════════════════
-- Salvaguarda de transição: coerência status(enum) <-> processed(legado)
-- Garante zero divergência enquanto o modelo antigo e o novo coexistem.
-- status é a FONTE DA VERDADE; processed/images_processed são espelhos.
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_sync_raw_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.processed        := (NEW.status = 'processed');
    NEW.images_processed := (NEW.images_status = 'processed');
    IF NEW.process_errors IS NOT NULL AND NEW.last_error IS NULL THEN
      NEW.last_error := NEW.process_errors;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Se o enum mudou, ele manda → espelha em processed.
    -- Senão, se o código legado mexeu em processed, reflete de volta no enum.
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.processed := (NEW.status = 'processed');
    ELSIF NEW.processed IS DISTINCT FROM OLD.processed THEN
      NEW.status := CASE
        WHEN NEW.processed                  THEN 'processed'
        WHEN NEW.process_errors IS NOT NULL THEN 'failed'
        ELSE 'pending' END::supplier_raw_status;
    END IF;

    IF NEW.images_status IS DISTINCT FROM OLD.images_status THEN
      NEW.images_processed := (NEW.images_status = 'processed');
    ELSIF NEW.images_processed IS DISTINCT FROM OLD.images_processed THEN
      NEW.images_status := CASE WHEN NEW.images_processed THEN 'processed' ELSE 'pending' END::supplier_raw_status;
    END IF;

    IF NEW.process_errors IS DISTINCT FROM OLD.process_errors AND NEW.process_errors IS NOT NULL THEN
      NEW.last_error := NEW.process_errors;
    END IF;

    IF NEW.status = 'processed' AND NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.processed_at := COALESCE(NEW.processed_at, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zz_sync_raw_status ON public.supplier_products_raw;
CREATE TRIGGER trg_zz_sync_raw_status
  BEFORE INSERT OR UPDATE ON public.supplier_products_raw
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_raw_status();
