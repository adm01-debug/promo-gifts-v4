-- Hotfix: digest() vive em extensions.* no Supabase; referência explícita.
-- Versão final e vigente de fn_spr_before_write (hash canônico):
--   • remove TODAS as chaves de metadado '_%' do raw_data persistido
--   • content_hash = sha256(raw_data sem chaves '_%' e sem
--     supplier_settings.hash_excluded_fields do fornecedor)
--   • mantém máquina de estados: attempts++/failed/quarantined via process_errors
CREATE OR REPLACE FUNCTION public.fn_spr_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_clean    jsonb;
  v_hashbase jsonb;
  v_excl     text[];
  v_k        text;
BEGIN
  IF NEW.raw_data ? '_source' AND COALESCE(NEW.source_channel,'') IN ('','n8n','legacy') THEN
    NEW.source_channel := NEW.raw_data->>'_source';
  END IF;
  IF NEW.raw_data ? '_imported_at' AND NEW.imported_at IS NULL THEN
    BEGIN NEW.imported_at := (NEW.raw_data->>'_imported_at')::timestamptz;
    EXCEPTION WHEN others THEN NULL; END;
  END IF;

  v_clean := NEW.raw_data;
  FOR v_k IN SELECT k FROM jsonb_object_keys(NEW.raw_data) k WHERE k LIKE E'\\_%' LOOP
    v_clean := v_clean - v_k;
  END LOOP;
  NEW.raw_data := v_clean;

  SELECT ss.hash_excluded_fields INTO v_excl
    FROM public.supplier_settings ss
   WHERE ss.supplier_id = NEW.supplier_id;
  v_hashbase := CASE WHEN v_excl IS NOT NULL AND array_length(v_excl,1) > 0
                     THEN v_clean - v_excl ELSE v_clean END;
  NEW.content_hash := encode(extensions.digest(v_hashbase::text, 'sha256'), 'hex');

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
END $$;
