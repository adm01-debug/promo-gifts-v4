-- P2.8 — Versionamento real da Bronze: arquiva versão anterior quando content_hash muda
CREATE OR REPLACE FUNCTION public.fn_version_supplier_raw_on_hash_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Só versiona quando o conteúdo realmente mudou (hash diferente e não-nulo)
  IF NEW.content_hash IS DISTINCT FROM OLD.content_hash THEN
    INSERT INTO public.supplier_products_raw_history
      (raw_id, supplier_id, supplier_reference, content_hash, raw_data, captured_at)
    VALUES
      (OLD.id, OLD.supplier_id, OLD.supplier_reference, OLD.content_hash, OLD.raw_data, OLD.updated_at);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_version_supplier_raw ON public.supplier_products_raw;
CREATE TRIGGER trg_version_supplier_raw
  BEFORE UPDATE OF content_hash ON public.supplier_products_raw
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_version_supplier_raw_on_hash_change();