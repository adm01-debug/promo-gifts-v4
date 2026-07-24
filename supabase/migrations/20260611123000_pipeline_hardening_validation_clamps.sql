-- ════════════════════════════════════════════════════════════════
-- HARDENING DA PADRONIZAÇÃO — achados da simulação massiva 2026-06-11
-- ════════════════════════════════════════════════════════════════
-- ACHADO #4 (sucesso falso / pai pendente eterno):
--   fn_standardize_raw deixava o pai com status='pending' quando os
--   mappings não produziam campos, retornando success=true. O pai
--   nunca era promovido nem rejeitado; os raws do grupo ficavam
--   'pending' para sempre, invisíveis ao monitoramento.
--   FIX: pós-UPDATE, name NULL ⇒ status 'rejected' + validation_errors
--   explicando; senão 'standardized'. Retorno success=false quando
--   rejected (fn_standardize_supplier passa a contabilizar e amostrar).
--   Além disso, fallback genérico de name (nome/Name/titulo/...) quando
--   o de-para não produz name — fornecedores novos funcionam no modo
--   genérico completo (variante + pai) sem mapping cadastrado.
--
-- ACHADO #5 (overflow numérico na promoção):
--   cost 1e99 passava pela padronização (Silver numeric ilimitado) e
--   estourava em products.cost_price numeric(10,2) na promoção,
--   prendendo o pai em 'standardized' com retry eterno.
--   FIX: clamp de domínio na padronização. Pai: custo/sugerido fora de
--   (0, 99999999.99] ⇒ descartado + validation_error. Variante: custo e
--   tiers fora de (0, 999999.9999] (teto do VSS numeric(10,4)) ⇒ NULL.
--   Max real hoje: 826.42 — folga de 3+ ordens de magnitude.
--
-- ACHADO #6 (estoque negativo atravessava ao Gold):
--   Só o branch XBZ clampava GREATEST(0,stock). SPOT -50 chegou a
--   product_variants.stock_quantity na simulação.
--   FIX: clamp universal v_stock := GREATEST(0, v_stock) pós-branches
--   em fn_standardize_variant (o pai já clampava).
-- ════════════════════════════════════════════════════════════════

-- ── (1) fn_standardize_raw: fallback name + clamp money + rejected explícito ──
CREATE OR REPLACE FUNCTION public.fn_standardize_raw(p_raw_id uuid, p_override_reference text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  r          public.supplier_products_raw%ROWTYPE;
  m          RECORD;
  v_val      text; v_tx text; v_path text;
  v_assigns  jsonb := '{}'::jsonb;
  v_errs     jsonb := '[]'::jsonb;
  v_ncm text; v_ncm_raw text;
  v_pad_id uuid; v_ref text;
  v_status public.produtos_padronizacao_status;
  v_final_name text;
  v_money numeric;
  v_cols text[] := ARRAY[
    'name','description','short_description','cost_price','suggested_price','stock_quantity',
    'primary_image_url','images','ncm_code','weight_g','height_cm','width_cm','length_cm',
    'dimensions_display','box_length_cm','box_width_cm','box_height_cm','box_weight_kg',
    'box_volume_cm3','box_quantity','box_inner_quantity','brand','packing_type','repacking_type',
    'capacities','capacity_ml','min_quantity','ipi_rate','engraving_type','is_active',
    'product_type','origin_country','combined_sizes','box_image',
    'is_textil','is_stockout','is_online_exclusive','is_new','has_colors','has_sizes',
    'allows_personalization','tags','materials','meta_keywords'
  ];
BEGIN
  SELECT * INTO r FROM public.supplier_products_raw WHERE id = p_raw_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'raw_nao_encontrado'); END IF;
  v_ref := COALESCE(NULLIF(TRIM(p_override_reference),''), r.supplier_reference);

  FOR m IN
    SELECT source_field, source_path, target_field, transform_type, transform_config, source_unit, target_unit
    FROM public.supplier_field_mappings
    WHERE supplier_id=r.supplier_id AND target_table='products' AND is_active=TRUE AND target_field=ANY(v_cols)
    ORDER BY priority NULLS LAST
  LOOP
    BEGIN
      IF m.source_path IS NOT NULL AND m.source_path <> '' THEN
        v_path := regexp_replace(m.source_path, E'^\\$\\.?', '');
        v_val  := r.raw_data #>> string_to_array(v_path, '.');
      ELSE
        v_val := r.raw_data ->> m.source_field;
      END IF;

      IF v_val IS NULL THEN CONTINUE; END IF;

      v_tx := public.fn_apply_transform(
        v_val, m.transform_type, m.transform_config,
        m.source_unit, m.target_unit,
        r.supplier_id
      );

      v_assigns := v_assigns || jsonb_build_object(m.target_field, v_tx);
    EXCEPTION WHEN OTHERS THEN
      v_errs := v_errs || jsonb_build_object('field', m.target_field, 'error', SQLERRM);
    END;
  END LOOP;

  -- FALLBACK genérico de name (2026-06-11): de-para não produziu name ⇒
  -- tenta chaves convencionais. Fornecedor novo roda no modo genérico.
  IF NULLIF(TRIM(v_assigns->>'name'),'') IS NULL THEN
    v_val := COALESCE(
      NULLIF(TRIM(r.raw_data->>'nome'),''),
      NULLIF(TRIM(r.raw_data->>'Nome'),''),
      NULLIF(TRIM(r.raw_data->>'name'),''),
      NULLIF(TRIM(r.raw_data->>'Name'),''),
      NULLIF(TRIM(r.raw_data->>'titulo'),''),
      NULLIF(TRIM(r.raw_data->>'Titulo'),''));
    IF v_val IS NOT NULL THEN
      v_assigns := v_assigns || jsonb_build_object('name', v_val);
    END IF;
  END IF;

  -- CLAMP money (2026-06-11): fora de (0, 99999999.99] não entra na Silver
  -- (products.cost_price é numeric(10,2); evita overflow na promoção).
  FOREACH v_val IN ARRAY ARRAY['cost_price','suggested_price'] LOOP
    IF v_assigns ? v_val THEN
      v_money := public.fn_safe_num(v_assigns->>v_val);
      IF v_money IS NOT NULL AND (v_money < 0 OR v_money > 99999999.99) THEN
        v_assigns := v_assigns - v_val;
        v_errs := v_errs || jsonb_build_object('field', v_val, 'error',
          'valor_fora_do_dominio: '||v_money::text);
      END IF;
    END IF;
  END LOOP;

  -- NCM: normaliza; inválido (placeholder/formatos quebrados) é removido
  v_ncm_raw := COALESCE(v_assigns->>'ncm_code', r.raw_data->>'Ncm', r.raw_data->>'ncm');
  IF v_ncm_raw IS NOT NULL THEN
    v_ncm := public.fn_normalize_ncm(v_ncm_raw);
    IF v_ncm IS NOT NULL THEN
      v_assigns := v_assigns || jsonb_build_object('ncm_code', v_ncm);
    ELSE
      v_assigns := v_assigns - 'ncm_code';
    END IF;
  END IF;

  SELECT id INTO v_pad_id FROM public.produtos_padronizacao
  WHERE supplier_id = r.supplier_id AND supplier_reference = v_ref;

  IF v_pad_id IS NULL THEN
    INSERT INTO public.produtos_padronizacao
      (supplier_id, supplier_reference, raw_id, status)
    VALUES (r.supplier_id, v_ref, r.id, 'pending')
    RETURNING id INTO v_pad_id;
  END IF;

  -- BRAND PERMANENTE: sempre nome do supplier na Silver
  v_assigns := v_assigns || jsonb_build_object(
    'brand', public.fn_brand_from_supplier(r.supplier_id)
  );

  -- Clamp: stock negativo → 0
  IF (v_assigns->>'stock_quantity') IS NOT NULL
    AND public.fn_safe_num(v_assigns->>'stock_quantity') IS NOT NULL
    AND public.fn_safe_num(v_assigns->>'stock_quantity') < 0 THEN
    v_assigns := v_assigns || jsonb_build_object('stock_quantity', 0);
  END IF;

  UPDATE public.produtos_padronizacao
  SET
    name               = COALESCE(public.fn_normalize_product_name(v_assigns->>'name'), name),
    description        = COALESCE((v_assigns->>'description')::text,                                   description),
    short_description  = COALESCE((v_assigns->>'short_description')::text,                             short_description),
    cost_price         = COALESCE(NULLIF(public.fn_safe_num(v_assigns->>'cost_price'),      0),        cost_price),
    suggested_price    = COALESCE(NULLIF(public.fn_safe_num(v_assigns->>'suggested_price'), 0),        suggested_price),
    stock_quantity     = COALESCE(public.fn_safe_int(v_assigns->>'stock_quantity'),                     stock_quantity),
    primary_image_url  = COALESCE((v_assigns->>'primary_image_url')::text,                             primary_image_url),
    images             = COALESCE(public.fn_safe_jsonb_arr(v_assigns->>'images'),                       images),
    ncm_code           = COALESCE((v_assigns->>'ncm_code')::text,                                      ncm_code),
    weight_g           = COALESCE(NULLIF(public.fn_safe_int(v_assigns->>'weight_g'),  0),              weight_g),
    height_cm          = COALESCE(NULLIF(public.fn_safe_num(v_assigns->>'height_cm'), 0),              height_cm),
    width_cm           = COALESCE(NULLIF(public.fn_safe_num(v_assigns->>'width_cm'),  0),              width_cm),
    length_cm          = COALESCE(NULLIF(public.fn_safe_num(v_assigns->>'length_cm'), 0),              length_cm),
    dimensions_display = COALESCE((v_assigns->>'dimensions_display')::text,                            dimensions_display),
    box_length_cm      = COALESCE(NULLIF(public.fn_safe_num(v_assigns->>'box_length_cm'), 0),          box_length_cm),
    box_width_cm       = COALESCE(NULLIF(public.fn_safe_num(v_assigns->>'box_width_cm'),  0),          box_width_cm),
    box_height_cm      = COALESCE(NULLIF(public.fn_safe_num(v_assigns->>'box_height_cm'), 0),          box_height_cm),
    box_weight_kg      = COALESCE(NULLIF(public.fn_safe_num(v_assigns->>'box_weight_kg'), 0),          box_weight_kg),
    box_volume_cm3     = COALESCE(NULLIF(public.fn_safe_num(v_assigns->>'box_volume_cm3'),0),          box_volume_cm3),
    box_quantity       = COALESCE(NULLIF(public.fn_safe_int(v_assigns->>'box_quantity'), 0),           box_quantity),
    box_inner_quantity = COALESCE(NULLIF(public.fn_safe_int(v_assigns->>'box_inner_quantity'), 0),     box_inner_quantity),
    brand              = COALESCE((v_assigns->>'brand')::text,                                          brand),
    packing_type       = COALESCE((v_assigns->>'packing_type')::text,                                   packing_type),
    repacking_type     = COALESCE((v_assigns->>'repacking_type')::text,                                 repacking_type),
    capacities         = COALESCE((v_assigns->>'capacities')::text,                                     capacities),
    capacity_ml        = COALESCE(NULLIF(public.fn_safe_int(v_assigns->>'capacity_ml'), 0),            capacity_ml),
    min_quantity       = COALESCE(public.fn_safe_int(v_assigns->>'min_quantity'),                       min_quantity),
    ipi_rate           = COALESCE(public.fn_safe_num(v_assigns->>'ipi_rate'),                           ipi_rate),
    engraving_type     = COALESCE((v_assigns->>'engraving_type')::text,                                 engraving_type),
    is_active          = COALESCE(public.fn_safe_bool(v_assigns->>'is_active'),                         is_active),
    product_type       = COALESCE((v_assigns->>'product_type')::text,                                   product_type),
    origin_country     = COALESCE((v_assigns->>'origin_country')::text,                                 origin_country),
    combined_sizes     = COALESCE((v_assigns->>'combined_sizes')::text,                                 combined_sizes),
    box_image          = COALESCE((v_assigns->>'box_image')::text,                                      box_image),
    is_textil              = COALESCE(public.fn_safe_bool(v_assigns->>'is_textil'),              is_textil),
    is_stockout            = COALESCE(public.fn_safe_bool(v_assigns->>'is_stockout'),            is_stockout),
    is_online_exclusive    = COALESCE(public.fn_safe_bool(v_assigns->>'is_online_exclusive'),    is_online_exclusive),
    is_new                 = COALESCE(public.fn_safe_bool(v_assigns->>'is_new'),                 is_new),
    has_colors             = COALESCE(public.fn_safe_bool(v_assigns->>'has_colors'),             has_colors),
    has_sizes              = COALESCE(public.fn_safe_bool(v_assigns->>'has_sizes'),              has_sizes),
    allows_personalization = COALESCE(public.fn_safe_bool(v_assigns->>'allows_personalization'), allows_personalization),
    tags               = COALESCE(public.fn_safe_jsonb_arr(v_assigns->>'tags'),                         tags),
    materials          = COALESCE(public.fn_safe_jsonb_arr(v_assigns->>'materials'),                    materials),
    meta_keywords      = COALESCE(public.fn_safe_text_arr(v_assigns->>'meta_keywords'),                 meta_keywords),
    raw_id             = r.id,
    updated_at         = now()
  WHERE id = v_pad_id
  RETURNING name INTO v_final_name;

  -- STATUS EXPLÍCITO (2026-06-11): name resolvido ⇒ standardized;
  -- sem name ⇒ rejected COM motivo. 'pending' deixa de existir
  -- pós-padronização (era invisível e nunca promovia).
  IF v_final_name IS NOT NULL AND TRIM(v_final_name) <> '' THEN
    v_status := 'standardized';
  ELSE
    v_status := 'rejected';
    v_errs := v_errs || jsonb_build_object('field','name','error',
      'name_ausente: nenhum mapping/fallback produziu nome');
  END IF;

  UPDATE public.produtos_padronizacao
  SET status            = v_status,
      standardized_at   = CASE WHEN v_status='standardized' THEN now() ELSE standardized_at END,
      validation_errors = CASE WHEN jsonb_array_length(v_errs) > 0 THEN v_errs ELSE NULL END
  WHERE id = v_pad_id;

  -- Enriquecimento canônico (só preenche NULLs): ipi/ncm/materials/tags/meta/description
  PERFORM public.fn_enrich_padronizacao(v_pad_id);

  RETURN jsonb_build_object(
    'success', v_status = 'standardized', 'pad_id', v_pad_id,
    'status', v_status, 'fields_set', v_assigns,
    'errors', v_errs
  );
END;
$function$;

COMMENT ON FUNCTION public.fn_standardize_raw(uuid, text) IS
  'Bronze->Silver (produto/pai) via de-para supplier_field_mappings + fallback generico de name. '
  '2026-06-11: clamp money (0,1e8]; sem name => rejected + validation_errors + success=false '
  '(antes ficava pending invisivel com success=true).';

-- ── (2) fn_standardize_variant: clamps universais de estoque e custo ──
-- (corpo idêntico ao de 20260611120000 + clamps pós-branches)

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

  -- CLAMPS universais (2026-06-11, achados #5/#6 da simulação):
  -- estoque negativo não existe no domínio; custo fora de (0, 999999.9999]
  -- (teto do VSS numeric(10,4)) é lixo de feed e não entra na Silver.
  v_stock := GREATEST(0, v_stock);
  IF v_cost  IS NOT NULL AND (v_cost  < 0 OR v_cost  > 999999.9999) THEN v_cost  := NULL; END IF;
  IF v_cp1   IS NOT NULL AND (v_cp1   < 0 OR v_cp1   > 999999.9999) THEN v_cp1   := NULL; END IF;
  IF v_cp2   IS NOT NULL AND (v_cp2   < 0 OR v_cp2   > 999999.9999) THEN v_cp2   := NULL; END IF;
  IF v_cp3   IS NOT NULL AND (v_cp3   < 0 OR v_cp3   > 999999.9999) THEN v_cp3   := NULL; END IF;
  IF v_cp4   IS NOT NULL AND (v_cp4   < 0 OR v_cp4   > 999999.9999) THEN v_cp4   := NULL; END IF;
  IF v_cp5   IS NOT NULL AND (v_cp5   < 0 OR v_cp5   > 999999.9999) THEN v_cp5   := NULL; END IF;

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
  'Bronze->Silver (variante). De-para p/ SPOT e SM; hardcoded XBZ/Asia; fallback generico. '
  '2026-06-11: clamps universais GREATEST(0,stock) e custo (0,999999.9999] (achados #5/#6).';

-- ── (3) fn_standardize_variant: ELSE genérico vira leitor de-para (Fase 6) ──
-- Fornecedores sem branch dedicado (ex.: 88 Brindes) liam apenas chaves fixas
-- (cor/estoque/preco_base) e ignoravam seus supplier_field_mappings — 40
-- variantes do 88B sem custo/thumbnail. Injeção idempotente no fonte vivo
-- (aborta se o anchor não for encontrado byte a byte; no-op se já aplicado).
DO $$
DECLARE
  v_src text;
  v_old text := E'  ELSE\n'
    || E'    v_cname:=r.raw_data->>''cor''; v_supplier_sku:=r.supplier_reference;\n'
    || E'    v_stock:=public.fn_safe_int(r.raw_data->>''estoque''); v_cost:=public.fn_safe_num(r.raw_data->>''preco_base''); v_sku:=r.supplier_reference;\n'
    || E'  END IF;';
  v_new text := E'  ELSE\n'
    || E'    -- DE-PARA genérico (2026-06-11, Fase 6): fornecedores sem branch dedicado\n'
    || E'    -- leem supplier_field_mappings (product_variants/VSS) como SPOT/SM,\n'
    || E'    -- com fallback nas chaves convencionais do feed.\n'
    || E'    FOR m IN SELECT sfm.source_field,sfm.target_field,sfm.target_table,sfm.transform_type,sfm.transform_config,sfm.source_unit,sfm.target_unit\n'
    || E'             FROM public.supplier_field_mappings sfm\n'
    || E'             WHERE sfm.supplier_id=r.supplier_id AND sfm.target_table IN(''product_variants'',''variant_supplier_sources'') AND sfm.is_active=TRUE\n'
    || E'             ORDER BY sfm.target_table,sfm.priority NULLS LAST LOOP\n'
    || E'      v_val:=CASE WHEN m.transform_config->>''source_blob''=''stock_data'' THEN r.stock_data->>m.source_field ELSE r.raw_data->>m.source_field END;\n'
    || E'      CONTINUE WHEN v_val IS NULL OR TRIM(v_val)='''';\n'
    || E'      BEGIN v_tx:=public.fn_apply_transform(v_val,m.transform_type,m.transform_config,m.source_unit,m.target_unit,r.supplier_id); EXCEPTION WHEN OTHERS THEN v_tx:=v_val; END;\n'
    || E'      CONTINUE WHEN v_tx IS NULL;\n'
    || E'      IF m.target_table=''product_variants'' THEN v_pv_assigns:=v_pv_assigns||jsonb_build_object(m.target_field,v_tx);\n'
    || E'      ELSE v_vss_assigns:=v_vss_assigns||jsonb_build_object(m.target_field,v_tx); END IF;\n'
    || E'    END LOOP;\n'
    || E'    v_cname:=COALESCE(NULLIF(TRIM(v_pv_assigns->>''color_name''),''''),r.raw_data->>''cor'');\n'
    || E'    v_chex:=NULLIF(TRIM(v_pv_assigns->>''color_hex''),'''');\n'
    || E'    v_supplier_sku:=COALESCE(NULLIF(TRIM(v_pv_assigns->>''supplier_sku''),''''),NULLIF(TRIM(r.raw_data->>''sku_fornecedor''),''''),r.supplier_reference);\n'
    || E'    v_sku:=COALESCE(NULLIF(TRIM(v_pv_assigns->>''sku''),''''),r.supplier_reference);\n'
    || E'    v_stock:=public.fn_safe_int(COALESCE(v_pv_assigns->>''stock_quantity'',v_vss_assigns->>''quantity'',r.raw_data->>''estoque''));\n'
    || E'    v_cost:=public.fn_safe_num(COALESCE(v_vss_assigns->>''cost_price'',v_pv_assigns->>''cost_price'',r.raw_data->>''preco_custo'',r.raw_data->>''preco_base'',r.raw_data->>''preco''));\n'
    || E'    v_cp1:=v_cost;\n'
    || E'    v_thumb:=NULLIF(TRIM(COALESCE(v_pv_assigns->>''supplier_thumbnail'',v_vss_assigns->>''supplier_thumbnail'',r.raw_data->>''imagem_principal'',r.raw_data->>''url_foto'')),'''');\n'
    || E'  END IF;';
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src
  FROM pg_proc WHERE proname='fn_standardize_variant' AND pronamespace='public'::regnamespace;
  IF v_src LIKE '%DE-PARA genérico (2026-06-11%' THEN
    RAISE NOTICE 'else de-para já aplicado — no-op'; RETURN;
  END IF;
  IF position(v_old IN v_src) = 0 THEN
    RAISE EXCEPTION 'bloco ELSE não encontrado byte a byte — abortando';
  END IF;
  v_src := replace(v_src, v_old, v_new);
  EXECUTE v_src;
END $$;

-- ── (4) fn_standardize_supplier: erro do pai com status + detalhe ──
-- 'pai_falhou:desconhecido' virava ruído; agora amostra o status real
-- (ex.: rejected) e o primeiro erro de validação.
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src
  FROM pg_proc WHERE proname='fn_standardize_supplier' AND pronamespace='public'::regnamespace;
  IF v_src LIKE '%pai_falhou_status%' THEN RAISE NOTICE 'no-op'; RETURN; END IF;
  v_src := replace(v_src,
    $old$RAISE EXCEPTION 'pai_falhou:%', COALESCE(v_pres->>'error', 'desconhecido');$old$,
    $new$RAISE EXCEPTION 'pai_falhou_status_%: %', COALESCE(v_pres->>'status','?'),
          COALESCE(v_pres->>'error', v_pres->'errors'->0->>'error', 'sem_detalhe');$new$);
  EXECUTE v_src;
END $$;
