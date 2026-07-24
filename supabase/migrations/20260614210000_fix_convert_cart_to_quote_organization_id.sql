-- fix(cart): fn_convert_cart_to_quote grava organization_id + backfill de rascunhos orfaos
--
-- Bug: a RPC criava quotes sem organization_id. O RLS quotes_select_scope exige
-- user_is_org_member(organization_id); com org NULL nem o proprio dono le o rascunho
-- -> /orcamentos/:id/editar recebia 0 linhas -> 406 (Not Acceptable) em loop.
-- O INSERT passava por ser SECURITY DEFINER; o SELECT do navegador (RLS), nao.
--
-- Ja aplicado em producao; este arquivo registra a migration para o repo nao divergir do DB.
-- Idempotente: CREATE OR REPLACE + backfill com WHERE organization_id IS NULL.

CREATE TABLE IF NOT EXISTS public._backup_quotes_orgid_null_20260614 AS
  SELECT id, organization_id, created_by, seller_id, created_at
  FROM public.quotes WHERE organization_id IS NULL;

CREATE OR REPLACE FUNCTION public.fn_convert_cart_to_quote(p_cart_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid(); v_org uuid;
  v_cart public.seller_carts%ROWTYPE; v_quote_id uuid; v_it public.seller_cart_items%ROWTYPE;
  v_pid uuid; v_min int; v_eff int; v_oos boolean; v_count int;
  v_warnings jsonb := '[]'::jsonb; v_bumped jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Nao autenticado.' USING ERRCODE='28000'; END IF;
  SELECT * INTO v_cart FROM public.seller_carts WHERE id = p_cart_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Carrinho nao encontrado.' USING ERRCODE='P0002'; END IF;
  IF v_cart.seller_id <> v_uid THEN RAISE EXCEPTION 'Este carrinho nao pertence ao usuario atual.' USING ERRCODE='42501'; END IF;
  SELECT count(*) INTO v_count FROM public.seller_cart_items WHERE cart_id = p_cart_id;
  IF v_count = 0 THEN RAISE EXCEPTION 'Carrinho vazio - adicione itens antes de gerar o orcamento.' USING ERRCODE='23514'; END IF;
  SELECT organization_id INTO v_org FROM public.user_organizations WHERE user_id = v_uid
    ORDER BY (role::text='owner') DESC, (role::text='admin') DESC, created_at ASC LIMIT 1;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Vendedor sem organizacao vinculada - nao e possivel gerar o orcamento.' USING ERRCODE='23514'; END IF;
  INSERT INTO public.quotes (organization_id, created_by, seller_id, status, client_name, client_company, notes)
  VALUES (v_org, v_uid, v_uid, 'draft', COALESCE(NULLIF(v_cart.company_name,''),'Cliente'), v_cart.company_name, v_cart.notes)
  RETURNING id INTO v_quote_id;
  FOR v_it IN SELECT * FROM public.seller_cart_items WHERE cart_id = p_cart_id ORDER BY sort_order NULLS LAST, created_at LOOP
    BEGIN v_pid := v_it.product_id::uuid; EXCEPTION WHEN others THEN v_pid := NULL; END;
    v_min := 1; v_oos := false;
    IF v_pid IS NOT NULL THEN
      SELECT COALESCE(min_order_quantity, min_quantity, 1), (is_stockout IS TRUE OR COALESCE(stock_quantity,0) <= 0) INTO v_min, v_oos FROM public.products WHERE id = v_pid;
      IF NOT FOUND THEN v_pid := NULL; v_min := 1; v_oos := false; END IF;
    END IF;
    v_eff := GREATEST(COALESCE(v_it.quantity,1), 1);
    IF v_eff < v_min THEN v_bumped := v_bumped || jsonb_build_object('produto', v_it.product_name, 'de', v_eff, 'para', v_min); v_eff := v_min; END IF;
    IF v_oos THEN v_warnings := v_warnings || jsonb_build_object('produto', v_it.product_name, 'aviso', 'sem estoque no momento'); END IF;
    INSERT INTO public.quote_items (quote_id, product_id, product_sku, product_name, product_image_url, unit_price, quantity, color_name, color_hex, notes, sort_order)
    VALUES (v_quote_id, v_pid, v_it.product_sku, v_it.product_name, v_it.product_image_url, COALESCE(v_it.product_price,0), v_eff, v_it.color_name, v_it.color_hex, v_it.notes, v_it.sort_order);
  END LOOP;
  DELETE FROM public.seller_carts WHERE id = p_cart_id;
  RETURN jsonb_build_object('quote_id', v_quote_id, 'items', v_count, 'bumped', v_bumped, 'warnings', v_warnings);
END $function$;

UPDATE public.quotes q
SET organization_id = (
  SELECT uo.organization_id FROM public.user_organizations uo
  WHERE uo.user_id = COALESCE(q.created_by, q.seller_id)
  ORDER BY (uo.role::text='owner') DESC, (uo.role::text='admin') DESC, uo.created_at ASC
  LIMIT 1)
WHERE q.organization_id IS NULL
  AND EXISTS (SELECT 1 FROM public.user_organizations uo2 WHERE uo2.user_id = COALESCE(q.created_by, q.seller_id));
