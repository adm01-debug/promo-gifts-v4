-- Hardening de concorrencia nos triggers de carrinhos (seller_carts / seller_cart_items).
-- Auditoria exaustiva encontrou dois triggers fazendo read-modify-write SEM lock; sob
-- READ COMMITTED, dois INSERTs concorrentes liam o mesmo estado e violavam invariantes:
--   1) assign_cart_item_sort_order: dois itens recebiam o MESMO sort_order (empate de ordem;
--      nao ha unique em (cart_id, sort_order) que barre).
--   2) enforce_seller_cart_limit: o teto de 3 carrinhos por vendedor podia ser furado (4+),
--      pois o trigger e o UNICO gate (sem exclusion/check de cap).
-- Correcao: advisory lock TRANSACIONAL por chave (cart_id / seller_id), liberado no commit,
-- serializando apenas operacoes concorrentes do MESMO carrinho/vendedor (contencao minima).
-- Namespaces distintos: 415263 (sort_order) e 415264 (limite).

CREATE OR REPLACE FUNCTION public.assign_cart_item_sort_order()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.sort_order IS NULL)
     OR (TG_OP = 'UPDATE' AND NEW.cart_id <> OLD.cart_id) THEN
    PERFORM pg_advisory_xact_lock(415263, hashtext(NEW.cart_id::text));
    SELECT COALESCE(MAX(sort_order), -1) + 1
      INTO NEW.sort_order
      FROM public.seller_cart_items
     WHERE cart_id = NEW.cart_id
       AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_seller_cart_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM pg_advisory_xact_lock(415264, hashtext(NEW.seller_id::text));
  IF (SELECT count(*) FROM public.seller_carts WHERE seller_id = NEW.seller_id) >= 3 THEN
    RAISE EXCEPTION 'Limite de 3 carrinhos por vendedor atingido' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;
