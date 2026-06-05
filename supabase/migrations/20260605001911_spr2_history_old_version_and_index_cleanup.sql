
CREATE OR REPLACE FUNCTION public.fn_spr_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.content_hash IS DISTINCT FROM OLD.content_hash THEN
    INSERT INTO public.supplier_products_raw_history
      (raw_id, supplier_id, supplier_reference, content_hash, raw_data)
    VALUES (OLD.id, OLD.supplier_id, OLD.supplier_reference, OLD.content_hash, OLD.raw_data);
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_spr_history ON public.supplier_products_raw;
CREATE TRIGGER trg_spr_history
  AFTER UPDATE ON public.supplier_products_raw
  FOR EACH ROW EXECUTE FUNCTION public.fn_spr_history();

DROP INDEX IF EXISTS public.idx_spr_reference;
DROP INDEX IF EXISTS public.idx_spr_hist_ref;
