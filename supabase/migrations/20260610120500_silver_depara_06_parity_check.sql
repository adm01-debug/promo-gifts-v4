-- ════════════════════════════════════════════════════════════════
-- SILVER DE-PARA — Fase 6/6: verificação de PARIDADE (read-only)
-- fn_parity_standardize_variant compara, SEM gravar, a extração de campos de
-- variante pela lógica ANTIGA (hardcoded por UUID, congelada aqui) vs. a NOVA
-- (de-para via supplier_field_mappings + fn_apply_transform), sobre uma amostra
-- de supplier_products_raw. Emite uma linha por campo divergente.
--
-- Uso (esperado: zero linhas):
--   SELECT * FROM public.fn_parity_standardize_variant(500);
--   SELECT field, count(*) FROM public.fn_parity_standardize_variant(5000) GROUP BY 1;
--
-- Observação: parent_reference e a resolução de cor (fn_match_supplier_color/
-- canônica) não mudaram de lógica — a regra do pai foi apenas movida para o
-- de-para (Fase 3/4), preservando o resultado. Esta checagem foca na EXTRAÇÃO
-- crua dos campos, que é onde os branches por fornecedor viviam.
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_parity_standardize_variant(p_limit integer DEFAULT 500)
RETURNS TABLE(raw_id uuid, supplier uuid, field text, old_val text, new_val text)
LANGUAGE plpgsql STABLE
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  r public.supplier_products_raw%ROWTYPE;
  v_doc jsonb; m RECORD; v_val text; v_tx text; v_assigns jsonb;
  -- antigo (hardcoded)
  o_code text; o_apiid text; o_cname text; o_chex text; o_ssku text; o_sku text; o_stock text; o_cost text;
  -- novo (de-para)
  n_code text; n_apiid text; n_cname text; n_chex text; n_ssku text; n_sku text; n_stock text; n_cost text;
  v_SPOT uuid := 'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0';
  v_XBZ  uuid := 'd6718a29-e954-4c1b-bd84-03ea24884900';
  v_ASIA uuid := 'd2734e23-d633-4819-bb15-e51aa44e2118';
  v_SM   uuid := '841cd690-210a-422a-908c-7676828db272';
BEGIN
  FOR r IN
    SELECT * FROM public.supplier_products_raw
    WHERE supplier_id IN (v_SPOT, v_XBZ, v_ASIA, v_SM)
    ORDER BY imported_at DESC NULLS LAST
    LIMIT p_limit
  LOOP
    -- ── ANTIGO (congelado de 20260605101258) ──
    o_code:=NULL; o_apiid:=NULL; o_cname:=NULL; o_chex:=NULL; o_ssku:=NULL; o_stock:=NULL; o_cost:=NULL;
    IF r.supplier_id=v_SPOT THEN
      o_code:=r.raw_data->>'ColorCode'; o_cname:=r.raw_data->>'ColorName'; o_chex:=r.raw_data->>'ColorHex';
      o_ssku:=r.raw_data->>'Sku'; o_stock:=public.fn_safe_int(r.raw_data->>'StockQuantity')::text;
      o_cost:=public.fn_safe_num(r.raw_data->>'Price1')::text; o_sku:=r.supplier_reference;
    ELSIF r.supplier_id=v_XBZ THEN
      o_apiid:=r.raw_data->>'CorWebPrincipalId'; o_cname:=r.raw_data->>'CorWebPrincipal';
      o_ssku:=r.raw_data->>'CodigoComposto'; o_stock:=public.fn_safe_int(r.raw_data->>'QuantidadeDisponivel')::text;
      o_cost:=public.fn_safe_num(r.raw_data->>'PrecoVenda')::text; o_sku:='XBZ-'||r.supplier_reference;
    ELSIF r.supplier_id=v_ASIA THEN
      o_cname:=r.raw_data->>'var_cor_nome'; o_chex:=r.raw_data->>'var_cor_hex';
      o_ssku:=COALESCE(r.raw_data->>'var_referencia', r.supplier_reference);
      o_stock:=public.fn_safe_int(r.raw_data->>'var_estoque')::text;
      o_cost:=public.fn_safe_num(r.raw_data->>'preco')::text; o_sku:='ASIA-'||r.supplier_reference;
    ELSIF r.supplier_id=v_SM THEN
      o_cname:=public.fn_extract_color_from_title(r.raw_data->>'titulo');
      o_chex := public.fn_sm_hex_from_similares(r.raw_data->>'produtos_similares', r.supplier_reference);
      o_ssku:=r.supplier_reference; o_stock:=public.fn_safe_int(r.raw_data->>'estoque')::text;
      o_cost:=public.fn_safe_num(r.raw_data->>'preco_sem_gravacao_sem_impostos')::text; o_sku:=r.supplier_reference;
    END IF;

    -- ── NOVO (de-para, read-only: replica fn_standardize_variant sem gravar) ──
    v_doc := COALESCE(r.raw_data,'{}'::jsonb)
             || jsonb_build_object('_ref', r.supplier_reference)
             || jsonb_build_object('_sm_hex', public.fn_sm_hex_from_similares(r.raw_data->>'produtos_similares', r.supplier_reference));
    v_assigns := '{}'::jsonb;
    FOR m IN
      SELECT source_field, source_path, target_field, transform_type, transform_config, source_unit, target_unit
      FROM public.supplier_field_mappings
      WHERE supplier_id=r.supplier_id AND target_table='product_variants' AND is_active=TRUE
        AND target_field = ANY(ARRAY['sku','supplier_sku','color_code','color_api_id','color_name','color_hex','stock_quantity','cost_price'])
      ORDER BY priority
    LOOP
      IF m.source_path IS NOT NULL THEN v_val := v_doc #>> string_to_array(m.source_path,'.');
      ELSE v_val := v_doc ->> m.source_field; END IF;
      CONTINUE WHEN v_val IS NULL OR TRIM(v_val)='';
      BEGIN v_tx := public.fn_apply_transform(v_val, m.transform_type, m.transform_config, m.source_unit, m.target_unit, r.supplier_id);
      EXCEPTION WHEN OTHERS THEN v_tx := v_val; END;
      IF v_tx IS NOT NULL THEN v_assigns := v_assigns || jsonb_build_object(m.target_field, v_tx); END IF;
    END LOOP;
    n_code:=v_assigns->>'color_code'; n_apiid:=v_assigns->>'color_api_id';
    n_cname:=v_assigns->>'color_name'; n_chex:=v_assigns->>'color_hex';
    n_ssku:=COALESCE(v_assigns->>'supplier_sku', r.supplier_reference);
    n_sku:=COALESCE(v_assigns->>'sku', r.supplier_reference);
    n_stock:=public.fn_safe_int(v_assigns->>'stock_quantity')::text;
    n_cost:=public.fn_safe_num(v_assigns->>'cost_price')::text;

    -- ── DIFFS (NULLIF dos dois lados; '' antigo ≈ NULL novo é tolerado) ──
    IF NULLIF(o_sku,'')   IS DISTINCT FROM NULLIF(n_sku,'')   THEN raw_id:=r.id; supplier:=r.supplier_id; field:='sku';            old_val:=o_sku;   new_val:=n_sku;   RETURN NEXT; END IF;
    IF NULLIF(o_ssku,'')  IS DISTINCT FROM NULLIF(n_ssku,'')  THEN raw_id:=r.id; supplier:=r.supplier_id; field:='supplier_sku';   old_val:=o_ssku;  new_val:=n_ssku;  RETURN NEXT; END IF;
    IF NULLIF(o_code,'')  IS DISTINCT FROM NULLIF(n_code,'')  THEN raw_id:=r.id; supplier:=r.supplier_id; field:='color_code';     old_val:=o_code;  new_val:=n_code;  RETURN NEXT; END IF;
    IF NULLIF(o_apiid,'') IS DISTINCT FROM NULLIF(n_apiid,'') THEN raw_id:=r.id; supplier:=r.supplier_id; field:='color_api_id';   old_val:=o_apiid; new_val:=n_apiid; RETURN NEXT; END IF;
    IF NULLIF(o_cname,'') IS DISTINCT FROM NULLIF(n_cname,'') THEN raw_id:=r.id; supplier:=r.supplier_id; field:='color_name';     old_val:=o_cname; new_val:=n_cname; RETURN NEXT; END IF;
    IF NULLIF(o_chex,'')  IS DISTINCT FROM NULLIF(n_chex,'')  THEN raw_id:=r.id; supplier:=r.supplier_id; field:='color_hex';      old_val:=o_chex;  new_val:=n_chex;  RETURN NEXT; END IF;
    IF NULLIF(o_stock,'') IS DISTINCT FROM NULLIF(n_stock,'') THEN raw_id:=r.id; supplier:=r.supplier_id; field:='stock_quantity'; old_val:=o_stock; new_val:=n_stock; RETURN NEXT; END IF;
    IF NULLIF(o_cost,'')  IS DISTINCT FROM NULLIF(n_cost,'')  THEN raw_id:=r.id; supplier:=r.supplier_id; field:='cost_price';     old_val:=o_cost;  new_val:=n_cost;  RETURN NEXT; END IF;
  END LOOP;
END;
$function$;

COMMENT ON FUNCTION public.fn_parity_standardize_variant(integer) IS
  'Read-only: compara extração de variante ANTIGA (hardcoded) vs NOVA (de-para) sobre amostra de raws. Zero linhas = paridade. Usar antes de confiar no de-para em produção.';

REVOKE ALL ON FUNCTION public.fn_parity_standardize_variant(integer) FROM PUBLIC, anon, authenticated;
