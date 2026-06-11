-- Função para limitar a 3 carrinhos por vendedor
CREATE OR REPLACE FUNCTION public.check_seller_cart_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.seller_carts WHERE seller_id = NEW.seller_id) >= 3 THEN
    RAISE EXCEPTION 'Limite de 3 carrinhos simultâneos atingido';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Garante que o trigger esteja lá
DROP TRIGGER IF EXISTS enforce_seller_cart_limit ON public.seller_carts;
CREATE TRIGGER enforce_seller_cart_limit
  BEFORE INSERT ON public.seller_carts
  FOR EACH ROW EXECUTE FUNCTION public.check_seller_cart_limit();

-- Adiciona também um check no update se o seller_id mudar (raro, mas segurança extra)
DROP TRIGGER IF EXISTS enforce_seller_cart_limit_update ON public.seller_carts;
CREATE TRIGGER enforce_seller_cart_limit_update
  BEFORE UPDATE OF seller_id ON public.seller_carts
  FOR EACH ROW EXECUTE FUNCTION public.check_seller_cart_limit();
