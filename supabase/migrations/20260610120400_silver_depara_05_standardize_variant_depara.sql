-- ════════════════════════════════════════════════════════════════
-- SILVER DE-PARA — Fase 5/6: fn_standardize_variant 100% data-driven
-- Remove os blocos IF/ELSIF por UUID de fornecedor. Toda a extração de campos
-- de variante passa a vir do de-para (supplier_field_mappings,
-- target_table='product_variants', semeado na Fase 3) aplicado pelo motor
-- fn_apply_transform — exatamente como fn_standardize_raw já faz para o pai.
--
-- Equivalência de cor (fn_match_supplier_color → fn_match_canonical_color),
-- derivação do pai (fn_derive_parent_ref, agora config-driven), coerções seguras
-- (fn_safe_int/num) e o UPSERT permanecem IDÊNTICOS. Comportamento preservado
-- por construção; a única mudança benigna é que strings vazias viram NULL
-- (o loop ignora valores em branco), em vez de '' como antes.
--
-- Campos sintéticos do documento (não vêm do raw):
--   _ref     = supplier_reference  (fonte de sku/supplier_sku)
--   _sm_hex  = hex resolvido na rede produtos_similares (Só Marcas)
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_standardize_variant(p_raw_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  r public.supplier_products_raw%ROWTYPE;
  v_doc jsonb;
  m RECORD;
  v_val text; v_tx text;
  v_assigns jsonb := '{}'::jsonb;
  v_parent text;
  v_code text; v_apiid text; v_cname text; v_chex text;
  v_supplier_sku text; v_sku text; v_stock integer; v_cost numeric;
  v_col RECORD; v_fname text; v_fcode text; v_fhex text; v_canonical_id uuid;
  v_var_id uuid;
  v_cols text[] := ARRAY[
    'sku','supplier_sku','color_code','color_api_id','color_name','color_hex',
    'stock_quantity','cost_price'];
BEGIN
  SELECT * INTO r FROM public.supplier_products_raw WHERE id = p_raw_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'raw_nao_encontrado'); END IF;

  -- Documento de trabalho: raw + campos sintéticos supplier-agnostic.
  v_doc := COALESCE(r.raw_data, '{}'::jsonb)
           || jsonb_build_object('_ref', r.supplier_reference)
           || jsonb_build_object('_sm_hex',
                public.fn_sm_hex_from_similares(r.raw_data->>'produtos_similares', r.supplier_reference));

  -- Pai: config-driven (parent_reference no de-para).
  v_parent := public.fn_derive_parent_ref(r.supplier_id, r.supplier_reference, r.raw_data);

  -- De-para de variante (campos de variante; parent_reference é tratado acima).
  FOR m IN
    SELECT source_field, source_path, target_field, transform_type, transform_config, source_unit, target_unit
    FROM public.supplier_field_mappings
    WHERE supplier_id = r.supplier_id AND target_table = 'product_variants' AND is_active = TRUE
      AND target_field = ANY(v_cols)
    ORDER BY priority
  LOOP
    IF m.source_path IS NOT NULL THEN v_val := v_doc #>> string_to_array(m.source_path, '.');
    ELSE v_val := v_doc ->> m.source_field; END IF;
    CONTINUE WHEN v_val IS NULL OR TRIM(v_val) = '';
    BEGIN
      v_tx := public.fn_apply_transform(v_val, m.transform_type, m.transform_config, m.source_unit, m.target_unit, r.supplier_id);
    EXCEPTION WHEN OTHERS THEN v_tx := v_val;
    END;
    IF v_tx IS NOT NULL THEN v_assigns := v_assigns || jsonb_build_object(m.target_field, v_tx); END IF;
  END LOOP;

  -- Materializa com as coerções seguras herdadas da versão hardcoded.
  v_code         := v_assigns->>'color_code';
  v_apiid        := v_assigns->>'color_api_id';
  v_cname        := v_assigns->>'color_name';
  v_chex         := v_assigns->>'color_hex';
  v_supplier_sku := COALESCE(v_assigns->>'supplier_sku', r.supplier_reference);
  v_sku          := COALESCE(v_assigns->>'sku', r.supplier_reference);
  v_stock        := public.fn_safe_int(v_assigns->>'stock_quantity');
  v_cost         := public.fn_safe_num(v_assigns->>'cost_price');

  -- Resolução de cor (descritivos) + canônica — idêntico à versão anterior.
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
    stock_quantity=EXCLUDED.stock_quantity, cost_price=EXCLUDED.cost_price, is_active=EXCLUDED.is_active,
    status=EXCLUDED.status, updated_at=now()
  RETURNING pv.id INTO v_var_id;

  RETURN jsonb_build_object('success', true, 'variante_id', v_var_id, 'parent', v_parent,
                            'cor', v_fname, 'hex', v_fhex, 'color_id_canonico', v_canonical_id);
END;
$function$;

COMMENT ON FUNCTION public.fn_standardize_variant(uuid) IS
  'Padronizador bronze→silver de variante, 100% data-driven via de-para (supplier_field_mappings target_table=product_variants). '
  'Sem branches por fornecedor; cor via fn_match_supplier_color/fn_match_canonical_color; pai via fn_derive_parent_ref.';
