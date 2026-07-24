-- BUG-6 FIX: updateItemSortOrder executava N requests paralelos via Promise.all.
-- Com carrinhos grandes (50-200 itens) isso gerava N conexões DB simultâneas e
-- risco de rate limit no PostgREST. Esta função substitui por 1 round-trip.
--
-- Segurança: SECURITY DEFINER com SET search_path evita privilege escalation.
-- RLS guard interno: só atualiza itens cujo carrinho-pai pertence a auth.uid().

CREATE OR REPLACE FUNCTION public.fn_batch_update_cart_item_sort_order(
  p_updates jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  -- Valida entrada: deve ser um array JSON não-vazio
  IF jsonb_typeof(p_updates) <> 'array' OR jsonb_array_length(p_updates) = 0 THEN
    RETURN; -- no-op silencioso para chamadas vazias/inválidas
  END IF;

  -- Atualiza em um único UPDATE ... FROM (VALUES) com guard de ownership.
  -- RLS não se aplica em SECURITY DEFINER — usamos o EXISTS manual.
  UPDATE public.seller_cart_items sci
  SET
    sort_order = (u->>'sort_order')::integer,
    updated_at = now()
  FROM jsonb_array_elements(p_updates) AS u
  WHERE
    sci.id = (u->>'id')::uuid
    AND EXISTS (
      SELECT 1 FROM public.seller_carts sc
      WHERE sc.id = sci.cart_id
        AND sc.seller_id = v_uid
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_batch_update_cart_item_sort_order(jsonb) TO authenticated;
