
CREATE OR REPLACE FUNCTION public.check_seller_cart_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM pg_advisory_xact_lock(415264, hashtext(NEW.seller_id::text));
  IF (SELECT COUNT(*) FROM public.seller_carts WHERE seller_id = NEW.seller_id) >= 10 THEN
    RAISE EXCEPTION 'Limite de 10 carrinhos por vendedor atingido' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;
