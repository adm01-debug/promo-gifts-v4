
CREATE OR REPLACE FUNCTION public.fn_spr_before_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_clean jsonb;
BEGIN
  IF NEW.raw_data ? '_source' AND COALESCE(NEW.source_channel,'') IN ('','n8n','legacy') THEN
    NEW.source_channel := NEW.raw_data->>'_source';
  END IF;
  IF NEW.raw_data ? '_imported_at' AND NEW.imported_at IS NULL THEN
    BEGIN NEW.imported_at := (NEW.raw_data->>'_imported_at')::timestamptz;
    EXCEPTION WHEN others THEN NULL; END;
  END IF;

  v_clean := NEW.raw_data - '_source' - '_api_fields_count' - '_imported_at';
  NEW.raw_data     := v_clean;
  NEW.content_hash := md5(v_clean::text);

  IF TG_OP = 'INSERT' THEN
    NEW.imported_at := COALESCE(NEW.imported_at, now());
    IF NEW.process_errors IS NOT NULL AND NEW.last_error IS NULL THEN
      NEW.last_error := NEW.process_errors;
    END IF;
  ELSE
    NEW.updated_at := now();

    IF NEW.process_errors IS DISTINCT FROM OLD.process_errors
       AND NEW.process_errors IS NOT NULL THEN
      NEW.last_error := NEW.process_errors;
      NEW.attempts   := COALESCE(OLD.attempts, 0) + 1;
      IF NEW.status <> 'processed'::supplier_raw_status THEN
        NEW.status := CASE WHEN NEW.attempts >= 5
                           THEN 'quarantined'::supplier_raw_status
                           ELSE 'failed'::supplier_raw_status END;
      END IF;
    END IF;

    IF NEW.status = 'processed'::supplier_raw_status
       AND NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.processed_at := COALESCE(NEW.processed_at, now());
    END IF;
  END IF;

  RETURN NEW;
END $function$;

UPDATE public.supplier_products_raw
   SET status   = 'failed'::supplier_raw_status,
       attempts = GREATEST(attempts, 1)
 WHERE status = 'processed'::supplier_raw_status
   AND process_errors IS NOT NULL;

ALTER TABLE public.supplier_products_raw
  ADD CONSTRAINT chk_spr_no_processed_with_errors
  CHECK (NOT (status = 'processed'::supplier_raw_status AND process_errors IS NOT NULL));
