
CREATE OR REPLACE FUNCTION public.fn_standardize_variant(p_raw_id uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  r public.supplier_products_raw%ROWTYPE;
  v_parent text; v_code text; v_apiid text; v_cname text; v_chex text;
  v_col RECORD; v_sku text; v_supplier_sku text; v_stock integer; v_cost numeric; v_var_id uuid;
  v_fname text; v_fcode text; v_fhex text; v_canonical_id uuid; v_simil text;
  v_SPOT uuid := 'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0';
  v_XBZ  uuid := 'd6718a29-e954-4c1b-bd84-03ea24884900';
  v_ASIA uuid := 'd2734e23-d633-4819-bb15-e51aa44e2118';
  v_SM   uuid := '841cd690-210a-422a-908c-7676828db272';
BEGIN
  SELECT * INTO r FROM public.supplier_products_raw WHERE id=p_raw_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','raw_nao_encontrado'); END IF;
  v_parent := public.fn_derive_parent_ref(r.supplier_id, r.supplier_reference, r.raw_data);

  IF r.supplier_id=v_SPOT THEN
    v_code:=r.raw_data->>'ColorCode'; v_cname:=r.raw_data->>'ColorName'; v_chex:=r.raw_data->>'ColorHex';
    v_supplier_sku:=r.raw_data->>'Sku'; v_stock:=public.fn_safe_int(r.raw_data->>'StockQuantity');
    v_cost:=public.fn_safe_num(r.raw_data->>'Price1'); v_sku:=r.supplier_reference;
  ELSIF r.supplier_id=v_XBZ THEN
    v_apiid:=r.raw_data->>'CorWebPrincipalId'; v_cname:=r.raw_data->>'CorWebPrincipal';
    v_supplier_sku:=r.raw_data->>'CodigoComposto'; v_stock:=public.fn_safe_int(r.raw_data->>'QuantidadeDisponivel');
    v_cost:=public.fn_safe_num(r.raw_data->>'PrecoVenda'); v_sku:='XBZ-'||r.supplier_reference;
  ELSIF r.supplier_id=v_ASIA THEN
    v_cname:=r.raw_data->>'var_cor_nome'; v_chex:=r.raw_data->>'var_cor_hex';
    v_supplier_sku:=COALESCE(r.raw_data->>'var_referencia', r.supplier_reference);
    v_stock:=public.fn_safe_int(r.raw_data->>'var_estoque'); v_cost:=public.fn_safe_num(r.raw_data->>'preco');
    v_sku:='ASIA-'||r.supplier_reference;
  ELSIF r.supplier_id=v_SM THEN
    -- Só Marcas: custo = preco_sem_gravacao_sem_impostos; cor embutida em produtos_similares (CODE|hex|id|foto|titulo)
    v_cost:=public.fn_safe_num(r.raw_data->>'preco_sem_gravacao_sem_impostos');
    v_stock:=public.fn_safe_int(r.raw_data->>'estoque');
    v_supplier_sku:=r.supplier_reference; v_sku:=r.supplier_reference;
    v_simil:=r.raw_data->>'produtos_similares';
    IF v_simil IS NOT NULL THEN
      SELECT split_part(seg,'|',2) INTO v_chex
      FROM unnest(string_to_array(v_simil, ';')) seg
      WHERE split_part(seg,'|',1)=r.supplier_reference AND split_part(seg,'|',2) ~ '^#' LIMIT 1;
    END IF;
    v_cname:=NULL; -- nome da cor está embutido no título (decisão pendente p/ extrair)
  ELSE
    v_cname:=r.raw_data->>'cor'; v_supplier_sku:=r.supplier_reference;
    v_stock:=public.fn_safe_int(r.raw_data->>'estoque'); v_cost:=public.fn_safe_num(r.raw_data->>'preco_base');
    v_sku:=r.supplier_reference;
  END IF;

  SELECT * INTO v_col FROM public.fn_match_supplier_color(r.supplier_id, v_code, v_apiid, v_cname, v_chex);
  v_fname := COALESCE(v_col.color_name, v_cname);
  v_fcode := COALESCE(v_col.color_code, v_code);
  v_fhex  := COALESCE(v_col.color_hex,  v_chex);
  v_canonical_id := public.fn_match_canonical_color(v_fname, v_fhex);

  INSERT INTO public.produtos_padronizacao_variantes AS pv (
    raw_id, supplier_id, parent_reference, variant_reference,
    sku, supplier_sku, color_name, color_code, color_hex, color_id,
    stock_quantity, cost_price, is_active, status
  ) VALUES (
    r.id, r.supplier_id, v_parent, r.supplier_reference, v_sku, v_supplier_sku,
    v_fname, v_fcode, v_fhex, v_canonical_id,
    v_stock, v_cost, true, 'standardized'::public.produtos_padronizacao_status
  )
  ON CONFLICT (supplier_id, variant_reference) DO UPDATE SET
    raw_id=EXCLUDED.raw_id, parent_reference=EXCLUDED.parent_reference, sku=EXCLUDED.sku, supplier_sku=EXCLUDED.supplier_sku,
    color_name=EXCLUDED.color_name, color_code=EXCLUDED.color_code, color_hex=EXCLUDED.color_hex, color_id=EXCLUDED.color_id,
    stock_quantity=EXCLUDED.stock_quantity, cost_price=EXCLUDED.cost_price, status=EXCLUDED.status, updated_at=now()
  RETURNING pv.id INTO v_var_id;

  RETURN jsonb_build_object('success',true,'variante_id',v_var_id,'parent',v_parent,'cor',v_fname,'hex',v_fhex,'custo',v_cost);
END;
$$;
