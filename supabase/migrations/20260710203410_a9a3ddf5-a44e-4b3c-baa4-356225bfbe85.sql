
CREATE OR REPLACE FUNCTION public.enforce_seller_cart_ready_requires_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items_count integer;
BEGIN
  -- Só valida quando o status está transicionando PARA 'pronto_orcamento'
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status = 'pronto_orcamento' THEN
    SELECT COUNT(*)::int
      INTO v_items_count
      FROM public.seller_cart_items
     WHERE cart_id = NEW.id;

    IF COALESCE(v_items_count, 0) < 1 THEN
      RAISE EXCEPTION 'EMPTY_CART: carrinho vazio não pode estar pronto para orçamento'
        USING ERRCODE = 'check_violation',
              HINT = 'Adicione ao menos um item ao carrinho antes de marcá-lo como pronto para orçamento.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_seller_cart_ready_requires_items() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_seller_cart_ready_requires_items() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_seller_cart_ready_requires_items() FROM authenticated;

DROP TRIGGER IF EXISTS trg_enforce_seller_cart_ready_requires_items ON public.seller_carts;

CREATE TRIGGER trg_enforce_seller_cart_ready_requires_items
BEFORE UPDATE OF status ON public.seller_carts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_seller_cart_ready_requires_items();

COMMENT ON FUNCTION public.enforce_seller_cart_ready_requires_items() IS
  'Defense-in-depth: impede transição de status para pronto_orcamento quando o carrinho não possui itens em seller_cart_items. Emparelhado com src/lib/carts/status-transition-guard.ts no client.';
