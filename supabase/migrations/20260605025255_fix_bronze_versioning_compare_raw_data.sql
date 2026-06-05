-- Em BEFORE UPDATE, generated columns (content_hash) ainda não recalcularam.
-- Comparar raw_data diretamente (fonte do hash).
CREATE OR REPLACE FUNCTION public.fn_version_supplier_raw_on_hash_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.raw_data IS DISTINCT FROM OLD.raw_data THEN
    INSERT INTO public.supplier_products_raw_history
      (raw_id, supplier_id, supplier_reference, content_hash, raw_data, captured_at)
    VALUES
      (OLD.id, OLD.supplier_id, OLD.supplier_reference, OLD.content_hash, OLD.raw_data, OLD.updated_at);
  END IF;
  RETURN NEW;
END;
$function$;