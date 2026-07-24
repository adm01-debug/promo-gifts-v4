-- ════════════════════════════════════════════════════════════════
-- FIX CRÍTICO: fn_standardize_variant — v_fcode/v_fhex engolidos
-- por comentário de linha única.
-- ════════════════════════════════════════════════════════════════
-- O patch de 2026-06-09 ("PATCH uppercase color_name") colocou as
-- atribuições v_fcode:=... e v_fhex:=... NA MESMA LINHA, APÓS o
-- comentário `--`. O parser PL/pgSQL as tratou como comentário:
--
--   v_fname:=...; -- ✅ PATCH uppercase color_name v_fcode:=...; v_fhex:=...;
--                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
--                    tudo isto era comentário — nunca executou
--
-- Impacto medido (2026-06-11): color_code NULL em 9.892 variantes XBZ
-- (85%), 1.588 Asia, 753 SM; color_hex NULL em 9.902 XBZ, 753 SM,
-- 39 SPOT. SPOT escapou no code apenas porque o guard de 3 dígitos
-- reatribuía v_fcode em sequência.
--
-- Correção mínima: mesma função, com as 3 atribuições em linhas
-- próprias. Nenhuma outra lógica alterada. Backfill em migration
-- separada (re-padronização dos raws afetados).
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_standardize_variant(p_raw_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  r             public.supplier_products_raw%ROWTYPE;
  v_parent      text; v_code text; v_apiid text; v_cname text; v_chex text;
  v_col         RECORD;
  v_sku         text; v_supplier_sku text; v_stock integer; v_cost numeric; v_var_id uuid;
  v_fname       text; v_fcode text; v_fhex text; v_canonical_id uuid;
  v_cp1 numeric; v_cp2 numeric; v_cp3 numeric; v_cp4 numeric; v_cp5 numeric;
  v_mq1 int;    v_mq2 int;    v_mq3 int;    v_mq4 int;    v_mq5 int;
  v_nq1 int;    v_nq2 int;    v_nq3 int;
  v_nd1 date;   v_nd2 date;   v_nd3 date;
  v_mult        int;
  v_thumb       text;
  v_images      jsonb;
  v_videos      jsonb;
  v_cap_ml      int;
  v_SPOT        uuid := 'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0';
  v_XBZ         uuid := 'd6718a29-e954-4c1b-bd84-03ea24884900';
  v_ASIA        uuid := 'd2734e23-d633-4819-bb15-e51aa44e2118';
  v_SM          uuid := '841cd690-210a-422a-908c-7676828db272';
  m             RECORD; v_val text; v_tx text;
  v_pv_assigns  jsonb := '{}'::jsonb;
  v_vss_assigns jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO r FROM public.supplier_products_raw WHERE id = p_raw_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','raw_nao_encontrado'); END IF;
  v_parent := public.fn_derive_parent_ref(r.supplier_id, r.supplier_reference, r.raw_data);

  IF r.supplier_id = v_SPOT THEN
    FOR m IN SELECT sfm.source_field,sfm.target_field,sfm.target_table,sfm.transform_type,sfm.transform_config,sfm.source_unit,sfm.target_unit
             FROM public.supplier_field_mappings sfm
             WHERE sfm.supplier_id=v_SPOT AND sfm.target_table IN('product_variants','variant_supplier_sources')
               AND sfm.is_active=TRUE AND sfm.target_field NOT IN('color_id','size_id','web_sku','length_cm','width_cm')
             ORDER BY sfm.target_table,sfm.priority NULLS LAST LOOP
      v_val:=CASE WHEN m.transform_config->>'source_blob'='stock_data' THEN r.stock_data->>m.source_field ELSE r.raw_data->>m.source_field END;
      CONTINUE WHEN v_val IS NULL OR TRIM(v_val)='';
      BEGIN v_tx:=public.fn_apply_transform(v_val,m.transform_type,m.transform_config,m.source_unit,m.target_unit,v_SPOT);
      EXCEPTION WHEN OTHERS THEN v_tx:=v_val; END;
      CONTINUE WHEN v_tx IS NULL;
      IF m.target_table='product_variants' THEN v_pv_assigns:=v_pv_assigns||jsonb_build_object(m.target_field,v_tx);
      ELSE v_vss_assigns:=v_vss_assigns||jsonb_build_object(m.target_field,v_tx); END IF;
    END LOOP;
    v_supplier_sku:=v_pv_assigns->>'supplier_sku'; v_code:=v_pv_assigns->>'color_code';
    v_cname:=COALESCE(NULLIF(TRIM(v_pv_assigns->>'color_name'),''),r.raw_data->>'ColorDesc1');
    v_chex:=COALESCE(NULLIF(TRIM(v_pv_assigns->>'color_hex'),''),r.raw_data->>'ColorHex1');
    v_thumb:=COALESCE(v_pv_assigns->>'selected_thumbnail',v_vss_assigns->>'supplier_thumbnail');
    v_sku:=r.supplier_reference;
    BEGIN v_images:=COALESCE(CASE WHEN v_pv_assigns?'images' THEN(v_pv_assigns->>'images')::jsonb END,CASE WHEN v_vss_assigns?'supplier_images' THEN(v_vss_assigns->>'supplier_images')::jsonb END,'[]'::jsonb); EXCEPTION WHEN OTHERS THEN v_images:='[]'::jsonb; END;
    BEGIN v_videos:=CASE WHEN v_vss_assigns?'supplier_videos' THEN(v_vss_assigns->>'supplier_videos')::jsonb END; EXCEPTION WHEN OTHERS THEN v_videos:=NULL; END;
    v_stock:=public.fn_safe_int(COALESCE(v_vss_assigns->>'quantity',v_vss_assigns->>'stock_main_warehouse',r.stock_data->>'Quantity',r.raw_data->>'StockQuantity'));
    v_cost:=public.fn_safe_num(COALESCE(v_vss_assigns->>'cost_price',r.raw_data->>'Price1'));
    v_cp1:=public.fn_safe_num(COALESCE(v_vss_assigns->>'cost_price_1',r.raw_data->>'Price1'));
    v_cp2:=public.fn_safe_num(v_vss_assigns->>'cost_price_2'); v_cp3:=public.fn_safe_num(v_vss_assigns->>'cost_price_3');
    v_cp4:=public.fn_safe_num(v_vss_assigns->>'cost_price_4'); v_cp5:=public.fn_safe_num(v_vss_assigns->>'cost_price_5');
    v_mq1:=public.fn_safe_int(v_vss_assigns->>'min_qty_1'); v_mq2:=public.fn_safe_int(v_vss_assigns->>'min_qty_2');
    v_mq3:=public.fn_safe_int(v_vss_assigns->>'min_qty_3'); v_mq4:=public.fn_safe_int(v_vss_assigns->>'min_qty_4'); v_mq5:=public.fn_safe_int(v_vss_assigns->>'min_qty_5');
    v_mult:=public.fn_safe_int(COALESCE(v_vss_assigns->>'sale_multiplier',r.raw_data->>'Multiplier'));
    v_nq1:=public.fn_safe_int(v_vss_assigns->>'next_quantity_1'); v_nq2:=public.fn_safe_int(v_vss_assigns->>'next_quantity_2'); v_nq3:=public.fn_safe_int(v_vss_assigns->>'next_quantity_3');
    v_nd1:=CASE WHEN v_vss_assigns->>'next_date_1'~'^\d{4}-\d{2}-\d{2}' THEN LEFT(v_vss_assigns->>'next_date_1',10)::date END;
    v_nd2:=CASE WHEN v_vss_assigns->>'next_date_2'~'^\d{4}-\d{2}-\d{2}' THEN LEFT(v_vss_assigns->>'next_date_2',10)::date END;
    v_nd3:=CASE WHEN v_vss_assigns->>'next_date_3'~'^\d{4}-\d{2}-\d{2}' THEN LEFT(v_vss_assigns->>'next_date_3',10)::date END;

  ELSIF r.supplier_id = v_SM THEN
    FOR m IN SELECT sfm.source_field,sfm.target_field,sfm.target_table,sfm.transform_type,sfm.transform_config,sfm.source_unit,sfm.target_unit
             FROM public.supplier_field_mappings sfm
             WHERE sfm.supplier_id=v_SM AND sfm.target_table IN('product_variants','variant_supplier_sources') AND sfm.is_active=TRUE
             ORDER BY sfm.target_table,sfm.priority NULLS LAST LOOP
      v_val:=CASE WHEN m.transform_config->>'source_blob'='stock_data' THEN r.stock_data->>m.source_field ELSE r.raw_data->>m.source_field END;
      CONTINUE WHEN v_val IS NULL OR TRIM(v_val)='';
      BEGIN v_tx:=public.fn_apply_transform(v_val,m.transform_type,m.transform_config,m.source_unit,m.target_unit,v_SM); EXCEPTION WHEN OTHERS THEN v_tx:=v_val; END;
      CONTINUE WHEN v_tx IS NULL;
      IF m.target_table='product_variants' THEN v_pv_assigns:=v_pv_assigns||jsonb_build_object(m.target_field,v_tx);
      ELSE v_vss_assigns:=v_vss_assigns||jsonb_build_object(m.target_field,v_tx); END IF;
    END LOOP;
    v_cname:=public.fn_extract_color_from_title(r.raw_data->>'titulo');
    v_chex:=(SELECT split_part(item,'|',2) FROM unnest(string_to_array(r.raw_data->>'produtos_similares',';')) item WHERE split_part(item,'|',1)=r.supplier_reference AND split_part(item,'|',2)~*'^#[0-9a-f]{6}$' LIMIT 1);
    v_supplier_sku:=COALESCE(NULLIF(TRIM(v_pv_assigns->>'supplier_sku'),''),r.supplier_reference);
    v_sku:=r.supplier_reference;
    v_stock:=public.fn_safe_int(COALESCE(v_pv_assigns->>'stock_quantity',r.raw_data->>'estoque'));
    v_cost:=public.fn_safe_num(COALESCE(v_pv_assigns->>'cost_price',r.raw_data->>'preco_sem_gravacao_sem_impostos'));
    v_cp1:=public.fn_safe_num(COALESCE(v_pv_assigns->>'cost_price_1',r.raw_data->>'preco_sem_gravacao_sem_impostos'));
    v_cp2:=public.fn_safe_num(COALESCE(v_pv_assigns->>'cost_price_2',r.raw_data->>'preco_com_gravacao_sem_impostos'));
    v_cp3:=public.fn_safe_num(COALESCE(v_pv_assigns->>'cost_price_3',r.raw_data->>'preco_sem_gravacao_com_impostos'));
    v_cp4:=public.fn_safe_num(COALESCE(v_pv_assigns->>'cost_price_4',r.raw_data->>'preco_com_gravacao_com_impostos'));
    v_mq1:=public.fn_safe_int(COALESCE(v_pv_assigns->>'min_qty_1',r.raw_data->>'quantidade_minima_sugerida'));
    v_thumb:=NULLIF(TRIM(COALESCE(v_pv_assigns->>'supplier_thumbnail',r.raw_data->>'url_foto')),'');
    BEGIN v_images:=CASE WHEN v_pv_assigns?'supplier_images' THEN(v_pv_assigns->>'supplier_images')::jsonb ELSE NULL END; EXCEPTION WHEN OTHERS THEN v_images:=NULL; END;

  ELSIF r.supplier_id = v_XBZ THEN
    v_apiid        := r.raw_data->>'CorWebPrincipalId';
    v_cname        := r.raw_data->>'CorWebPrincipal';
    v_supplier_sku := r.raw_data->>'CodigoComposto';
    v_stock        := GREATEST(0,COALESCE(public.fn_safe_int(r.raw_data->>'QuantidadeDisponivel'),0));
    v_cost         := public.fn_safe_num(r.raw_data->>'PrecoVenda');
    v_sku          := 'XBZ-'||r.supplier_reference;
    v_mult         := CASE WHEN public.fn_safe_int(r.raw_data->>'Multiplos')>0 THEN public.fn_safe_int(r.raw_data->>'Multiplos') ELSE NULL END;
    v_mq1          := CASE WHEN public.fn_safe_int(r.raw_data->>'VendaMinima')>0 THEN public.fn_safe_int(r.raw_data->>'VendaMinima') ELSE NULL END;
    v_cap_ml := CASE
        WHEN r.raw_data->>'Nome' IS NOT NULL
         AND r.raw_data->>'Nome' !~* '(127v|220v|led|lampada|lâmpada|pisca)'
        THEN public.extract_capacity_ml(r.raw_data->>'Nome')
        ELSE NULL
    END;
    v_thumb := CASE
        WHEN r.raw_data->>'ImageLink' LIKE 'https://%' OR r.raw_data->>'ImageLink' LIKE 'http://%' THEN r.raw_data->>'ImageLink'
        WHEN r.raw_data->>'ImageLink' LIKE 'hhttps://%' THEN SUBSTRING(r.raw_data->>'ImageLink' FROM 2)
        WHEN r.raw_data->>'ImageLink' LIKE 'htt%brindes.com.br%' THEN 'https://cdn.xbzbrindes.com.br'||SUBSTRING(r.raw_data->>'ImageLink' FROM POSITION('brindes.com.br' IN r.raw_data->>'ImageLink')+14)
        ELSE NULL END;
    BEGIN v_images:=CASE WHEN r.site_data->'imagens' IS NOT NULL AND jsonb_array_length(r.site_data->'imagens')>0 THEN r.site_data->'imagens' ELSE NULL END; EXCEPTION WHEN OTHERS THEN v_images:=NULL; END;
    BEGIN v_videos:=CASE WHEN (r.site_data->'video'->>'indicador')::boolean=true AND r.site_data->'video'->>'embed_id' IS NOT NULL
        THEN jsonb_build_array(jsonb_build_object('embed_id',r.site_data->'video'->>'embed_id','embed_url',r.site_data->'video'->>'embed_url','watch_url',r.site_data->'video'->>'watch_url','plataforma','youtube','indicador',true))
        ELSE NULL END; EXCEPTION WHEN OTHERS THEN v_videos:=NULL; END;
    v_nd1:=CASE WHEN r.raw_data->>'ReposicaoDataPrevista' IS NOT NULL AND LEFT(r.raw_data->>'ReposicaoDataPrevista',4)!='0001' THEN LEFT(r.raw_data->>'ReposicaoDataPrevista',10)::date ELSE NULL END;
    v_nq1:=CASE WHEN r.raw_data->>'QuantidadeDisponivelEstoquePrincipal' IS NOT NULL AND GREATEST(0,COALESCE(public.fn_safe_int(r.raw_data->>'QuantidadeDisponivel'),0))>GREATEST(0,COALESCE(public.fn_safe_int(r.raw_data->>'QuantidadeDisponivelEstoquePrincipal'),0)) THEN GREATEST(0,COALESCE(public.fn_safe_int(r.raw_data->>'QuantidadeDisponivel'),0)-GREATEST(0,COALESCE(public.fn_safe_int(r.raw_data->>'QuantidadeDisponivelEstoquePrincipal'),0))) ELSE NULL END;

  ELSIF r.supplier_id = v_ASIA THEN
    v_cname:=r.raw_data->>'var_cor_nome'; v_chex:=r.raw_data->>'var_cor_hex';
    v_supplier_sku:=COALESCE(r.raw_data->>'var_referencia',r.supplier_reference);
    v_stock:=public.fn_safe_int(COALESCE(r.stock_data->>'qtd_estoque',r.raw_data->>'var_estoque'));
    v_cost:=public.fn_safe_num(r.raw_data->>'preco'); v_sku:='ASIA-'||r.supplier_reference;
    v_nd1:=CASE WHEN COALESCE(r.stock_data->'previsao_entrega'->0->>'data',r.raw_data->'previsao_entrega'->0->>'data')~'^\d{4}-\d{2}-\d{2}' THEN LEFT(COALESCE(r.stock_data->'previsao_entrega'->0->>'data',r.raw_data->'previsao_entrega'->0->>'data'),10)::date END;
    v_nq1:=public.fn_safe_int(COALESCE(r.stock_data->'previsao_entrega'->0->>'quantidade',r.raw_data->'previsao_entrega'->0->>'quantidade'));
  ELSE
    v_cname:=r.raw_data->>'cor'; v_supplier_sku:=r.supplier_reference;
    v_stock:=public.fn_safe_int(r.raw_data->>'estoque'); v_cost:=public.fn_safe_num(r.raw_data->>'preco_base'); v_sku:=r.supplier_reference;
  END IF;

  SELECT * INTO v_col FROM public.fn_match_supplier_color(r.supplier_id,v_code,v_apiid,v_cname,v_chex);
  -- FIX 2026-06-11: as 3 atribuições abaixo estavam na MESMA linha de um
  -- comentário `--` (patch 2026-06-09) e nunca executavam; color_code e
  -- color_hex saíam NULL. Agora em linhas próprias.
  v_fname:=public.fn_normalize_product_name(COALESCE(v_col.color_name,v_cname));
  v_fcode:=COALESCE(v_col.color_code,v_code);
  v_fhex:=COALESCE(v_col.color_hex,v_chex);
  -- SPOT CANONICAL CODE GUARD (pipeline-proof 2026-06-09):
  -- Preserva código 3-dígitos da API (ex: '103') quando fn_match_supplier_color
  -- retorna código legado 2-dígitos via fallback de nome (ex: '03').
  IF r.supplier_id = v_SPOT AND v_code IS NOT NULL
     AND length(v_code) = 3 AND COALESCE(length(v_fcode), 0) < 3 THEN
    v_fcode := v_code;
  END IF;
  v_canonical_id:=public.fn_match_canonical_color(v_fname,v_fhex);

  INSERT INTO public.produtos_padronizacao_variantes AS pv (
    raw_id,supplier_id,parent_reference,variant_reference,sku,supplier_sku,color_name,color_code,color_hex,color_id,
    stock_quantity,cost_price,is_active,status,capacity_ml,
    cost_price_1,cost_price_2,cost_price_3,cost_price_4,cost_price_5,
    min_qty_1,min_qty_2,min_qty_3,min_qty_4,min_qty_5,
    next_quantity_1,next_quantity_2,next_quantity_3,next_date_1,next_date_2,next_date_3,
    sale_multiplier,supplier_thumbnail,supplier_images,supplier_videos
  ) VALUES (
    r.id,r.supplier_id,v_parent,r.supplier_reference,v_sku,v_supplier_sku,v_fname,v_fcode,v_fhex,v_canonical_id,
    v_stock,v_cost,true,'standardized'::public.produtos_padronizacao_status,v_cap_ml,
    v_cp1,v_cp2,v_cp3,v_cp4,v_cp5,
    v_mq1,v_mq2,v_mq3,v_mq4,v_mq5,
    v_nq1,v_nq2,v_nq3,v_nd1,v_nd2,v_nd3,
    v_mult,v_thumb,v_images,v_videos
  )
  ON CONFLICT (supplier_id,variant_reference) DO UPDATE SET
    raw_id=EXCLUDED.raw_id,parent_reference=EXCLUDED.parent_reference,sku=EXCLUDED.sku,supplier_sku=EXCLUDED.supplier_sku,
    color_name=EXCLUDED.color_name,color_code=EXCLUDED.color_code,color_hex=EXCLUDED.color_hex,
    color_id=COALESCE(EXCLUDED.color_id,pv.color_id),
    stock_quantity=EXCLUDED.stock_quantity,cost_price=EXCLUDED.cost_price,is_active=EXCLUDED.is_active,status=EXCLUDED.status,
    capacity_ml=COALESCE(EXCLUDED.capacity_ml, pv.capacity_ml),
    cost_price_1=EXCLUDED.cost_price_1,cost_price_2=EXCLUDED.cost_price_2,cost_price_3=EXCLUDED.cost_price_3,
    cost_price_4=EXCLUDED.cost_price_4,cost_price_5=EXCLUDED.cost_price_5,
    min_qty_1=EXCLUDED.min_qty_1,min_qty_2=EXCLUDED.min_qty_2,min_qty_3=EXCLUDED.min_qty_3,
    min_qty_4=EXCLUDED.min_qty_4,min_qty_5=EXCLUDED.min_qty_5,
    next_quantity_1=EXCLUDED.next_quantity_1,next_quantity_2=EXCLUDED.next_quantity_2,next_quantity_3=EXCLUDED.next_quantity_3,
    next_date_1=EXCLUDED.next_date_1,next_date_2=EXCLUDED.next_date_2,next_date_3=EXCLUDED.next_date_3,
    sale_multiplier=EXCLUDED.sale_multiplier,
    supplier_thumbnail=EXCLUDED.supplier_thumbnail,supplier_images=EXCLUDED.supplier_images,supplier_videos=EXCLUDED.supplier_videos,
    updated_at=now()
  RETURNING pv.id INTO v_var_id;

  RETURN jsonb_build_object(
    'success',true,'variante_id',v_var_id,'parent',v_parent,'cor',v_fname,
    'capacity_ml',v_cap_ml,'thumbnail',v_thumb IS NOT NULL,
    'images_count',CASE WHEN v_images IS NOT NULL THEN jsonb_array_length(v_images) ELSE 0 END,
    'has_video',v_videos IS NOT NULL,'cost_price',v_cost,'sale_multiplier',v_mult,'min_qty_1',v_mq1,
    'next_date_1',v_nd1,'next_quantity_1',v_nq1
  );
END;
$function$;

COMMENT ON FUNCTION public.fn_standardize_variant(uuid) IS
  'Bronze->Silver (variante). De-para supplier_field_mappings p/ SPOT e SM; hardcoded XBZ/Asia; fallback generico. '
  'FIX 2026-06-11: v_fcode/v_fhex estavam comentados desde 2026-06-09 (color_code/hex saiam NULL).';
