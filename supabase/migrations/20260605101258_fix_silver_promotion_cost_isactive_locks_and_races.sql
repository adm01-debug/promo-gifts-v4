-- Fixes do pipeline Silver (auditoria PR #659, achados CodeRabbit/cubic).
-- Todas as funções recriadas a partir do corpo atual com edições mínimas + search_path.

-- 1) fn_standardize_variant: restaura captura de custo XBZ (PrecoVenda) e ASIA
--    (preco) que a silver_08g regrediu; e inclui is_active no ON CONFLICT.
CREATE OR REPLACE FUNCTION public.fn_standardize_variant(p_raw_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  r public.supplier_products_raw%ROWTYPE;
  v_parent text; v_code text; v_apiid text; v_cname text; v_chex text;
  v_col RECORD; v_sku text; v_supplier_sku text; v_stock integer; v_cost numeric; v_var_id uuid;
  v_fname text; v_fcode text; v_fhex text; v_canonical_id uuid;
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
    v_cost:=public.fn_safe_num(r.raw_data->>'PrecoVenda');   -- PrecoVenda do XBZ = CUSTO (silver_08e)
    v_sku:='XBZ-'||r.supplier_reference;
  ELSIF r.supplier_id=v_ASIA THEN
    v_cname:=r.raw_data->>'var_cor_nome'; v_chex:=r.raw_data->>'var_cor_hex';
    v_supplier_sku:=COALESCE(r.raw_data->>'var_referencia', r.supplier_reference);
    v_stock:=public.fn_safe_int(r.raw_data->>'var_estoque');
    v_cost:=public.fn_safe_num(r.raw_data->>'preco');        -- preco da Asia = CUSTO (silver_08e)
    v_sku:='ASIA-'||r.supplier_reference;
  ELSIF r.supplier_id=v_SM THEN
    -- Só Marcas: sem campo de cor. Extrai do título; hex da rede de produtos_similares.
    v_cname:=public.fn_extract_color_from_title(r.raw_data->>'titulo');
    v_chex := (SELECT split_part(item,'|',2)
               FROM unnest(string_to_array(r.raw_data->>'produtos_similares', ';')) item
               WHERE split_part(item,'|',1)=r.supplier_reference
                 AND split_part(item,'|',2) ~* '^#[0-9a-f]{6}$' LIMIT 1);
    v_supplier_sku:=r.supplier_reference;
    v_stock:=public.fn_safe_int(r.raw_data->>'estoque');
    v_cost:=public.fn_safe_num(r.raw_data->>'preco_sem_gravacao_sem_impostos');
    v_sku:=r.supplier_reference;
  ELSE
    v_cname:=r.raw_data->>'cor'; v_supplier_sku:=r.supplier_reference;
    v_stock:=public.fn_safe_int(r.raw_data->>'estoque'); v_cost:=public.fn_safe_num(r.raw_data->>'preco_base');
    v_sku:=r.supplier_reference;
  END IF;

  -- resolução do fornecedor (descritivos). Para SM não há catálogo, usa o extraído.
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

  RETURN jsonb_build_object('success',true,'variante_id',v_var_id,'parent',v_parent,
                            'cor',v_fname,'hex',v_fhex,'color_id_canonico',v_canonical_id);
END;
$function$;

-- 2) fn_promote_variants_of_parent: VSS faz upsert (custo nao fica stale) e o
--    INSERT da variante e race-safe via ON CONFLICT (sku).
CREATE OR REPLACE FUNCTION public.fn_promote_variants_of_parent(p_supplier_id uuid, p_parent_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_pid uuid; v_org uuid; pv RECORD; v_vid uuid; v_count int := 0; v_attrs jsonb;
  v_existing_pid uuid;
BEGIN
  PERFORM set_config('app.write_source','pipeline',true);
  SELECT id, organization_id INTO v_pid, v_org FROM public.products
  WHERE supplier_id=p_supplier_id AND supplier_reference=p_parent_reference;
  IF v_pid IS NULL THEN RETURN jsonb_build_object('success',false,'error','produto_pai_nao_promovido','parent',p_parent_reference); END IF;

  FOR pv IN
    SELECT * FROM public.produtos_padronizacao_variantes
    WHERE supplier_id=p_supplier_id AND parent_reference=p_parent_reference AND status='standardized'
  LOOP
    v_attrs := jsonb_strip_nulls(jsonb_build_object('cor', pv.color_name, 'codigo_cor', pv.color_code, 'hex', pv.color_hex));

    -- idempotência por sku GLOBAL (sku é UNIQUE em product_variants); fallback (product_id, supplier_sku)
    SELECT id, product_id INTO v_vid, v_existing_pid FROM public.product_variants WHERE sku = pv.sku;
    IF v_vid IS NULL THEN
      SELECT id, product_id INTO v_vid, v_existing_pid FROM public.product_variants
      WHERE product_id=v_pid AND supplier_sku=pv.supplier_sku;
    END IF;

    IF v_vid IS NULL THEN
      -- race-safe: se outra sessao inserir o mesmo sku entre o SELECT e o INSERT,
      -- ON CONFLICT (sku) converte em UPDATE em vez de unique_violation.
      INSERT INTO public.product_variants (product_id, sku, supplier_sku, name, attributes, color_name, color_code, color_hex, color_id, stock_quantity, is_active, last_sync_at, last_sync_supplier_id)
      VALUES (v_pid, pv.sku, pv.supplier_sku, COALESCE(pv.color_name, pv.sku), v_attrs,
              pv.color_name, pv.color_code, pv.color_hex, pv.color_id,
              COALESCE(pv.stock_quantity,0), COALESCE(pv.is_active,true), now(), p_supplier_id)
      ON CONFLICT (sku) DO UPDATE SET
        supplier_sku = EXCLUDED.supplier_sku,
        attributes   = COALESCE(public.product_variants.attributes,'{}'::jsonb) || EXCLUDED.attributes,
        color_name   = COALESCE(EXCLUDED.color_name, public.product_variants.color_name),
        color_code   = COALESCE(EXCLUDED.color_code, public.product_variants.color_code),
        color_hex    = COALESCE(EXCLUDED.color_hex, public.product_variants.color_hex),
        color_id     = COALESCE(EXCLUDED.color_id, public.product_variants.color_id),
        stock_quantity = COALESCE(EXCLUDED.stock_quantity, public.product_variants.stock_quantity),
        last_sync_at = now(), last_sync_supplier_id = EXCLUDED.last_sync_supplier_id
      RETURNING id INTO v_vid;
    ELSE
      -- atualiza a variante existente (NÃO remapeia product_id para não mover variante entre produtos)
      UPDATE public.product_variants SET
        attributes = COALESCE(attributes,'{}'::jsonb) || v_attrs,
        color_name=COALESCE(pv.color_name,color_name), color_code=COALESCE(pv.color_code,color_code),
        color_hex=COALESCE(pv.color_hex,color_hex), color_id=COALESCE(pv.color_id,color_id),
        stock_quantity=COALESCE(pv.stock_quantity,stock_quantity), last_sync_at=now(), last_sync_supplier_id=p_supplier_id
      WHERE id=v_vid;
    END IF;

    IF pv.cost_price IS NOT NULL THEN
      INSERT INTO public.variant_supplier_sources (organization_id, variant_id, supplier_id, cost_price, supplier_sku, supplier_color_code, supplier_color_name, is_active, source, last_synced_at)
      VALUES (v_org, v_vid, p_supplier_id, pv.cost_price, pv.supplier_sku, pv.color_code, pv.color_name, true, 'silver', now())
      ON CONFLICT (variant_id, supplier_id) DO UPDATE SET
        cost_price          = EXCLUDED.cost_price,
        supplier_sku        = EXCLUDED.supplier_sku,
        supplier_color_code = EXCLUDED.supplier_color_code,
        supplier_color_name = EXCLUDED.supplier_color_name,
        is_active           = EXCLUDED.is_active,
        source              = EXCLUDED.source,
        last_synced_at      = EXCLUDED.last_synced_at;
    END IF;

    UPDATE public.produtos_padronizacao_variantes SET status='promoted', variant_id=v_vid, updated_at=now() WHERE id=pv.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('success',true,'product_id',v_pid,'variantes_promovidas',v_count);
END;
$function$;

-- 3) fn_promote_padronizacao: lock pessimista (FOR UPDATE) evita promocao
--    concorrente duplicada do mesmo registro silver.
CREATE OR REPLACE FUNCTION public.fn_promote_padronizacao(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  s         public.produtos_padronizacao%ROWTYPE;
  v_pid     uuid;
  v_org     uuid;
  v_locked  text[];
  v_is_new  boolean := false;
BEGIN
  SELECT * INTO s FROM public.produtos_padronizacao WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'padronizacao_nao_encontrada', 'id', p_id);
  END IF;
  IF s.status <> 'standardized' THEN
    RETURN jsonb_build_object('success', false, 'error', 'status_invalido', 'status', s.status);
  END IF;

  PERFORM set_config('app.write_source', 'pipeline', true);

  SELECT id, locked_fields INTO v_pid, v_locked
  FROM public.products
  WHERE supplier_id = s.supplier_id AND supplier_reference = s.supplier_reference;

  IF v_pid IS NULL THEN
    v_is_new := true;
    SELECT organization_id INTO v_org FROM public.suppliers WHERE id = s.supplier_id;
    INSERT INTO public.products (organization_id, supplier_id, supplier_reference, sku, name, active, is_active, product_type)
    VALUES (v_org, s.supplier_id, s.supplier_reference,
            COALESCE(s.supplier_reference, s.name), COALESCE(s.name,'Produto '||s.supplier_reference),
            COALESCE(s.is_active, true), COALESCE(s.is_active, true), 'product')
    RETURNING id, locked_fields INTO v_pid, v_locked;
  END IF;

  v_locked := COALESCE(v_locked, '{}');

  UPDATE public.products p SET
    name               = CASE WHEN 'name'               = ANY(v_locked) THEN p.name               ELSE COALESCE(s.name, p.name) END,
    description        = CASE WHEN 'description'        = ANY(v_locked) THEN p.description        ELSE COALESCE(s.description, p.description) END,
    short_description  = CASE WHEN 'short_description'  = ANY(v_locked) THEN p.short_description  ELSE COALESCE(s.short_description, p.short_description) END,
    cost_price         = CASE WHEN 'cost_price'         = ANY(v_locked) THEN p.cost_price         ELSE COALESCE(s.cost_price, p.cost_price) END,
    suggested_price    = CASE WHEN 'suggested_price'    = ANY(v_locked) THEN p.suggested_price    ELSE COALESCE(s.suggested_price, p.suggested_price) END,
    stock_quantity     = CASE WHEN 'stock_quantity'     = ANY(v_locked) THEN p.stock_quantity     ELSE COALESCE(s.stock_quantity, p.stock_quantity) END,
    primary_image_url  = CASE WHEN 'primary_image_url'  = ANY(v_locked) THEN p.primary_image_url  ELSE COALESCE(s.primary_image_url, p.primary_image_url) END,
    images             = CASE WHEN 'images'             = ANY(v_locked) THEN p.images             ELSE COALESCE(s.images, p.images) END,
    ncm_code           = CASE WHEN 'ncm_code'           = ANY(v_locked) THEN p.ncm_code           ELSE COALESCE(s.ncm_code, p.ncm_code) END,
    weight_g           = CASE WHEN 'weight_g'           = ANY(v_locked) THEN p.weight_g           ELSE COALESCE(s.weight_g, p.weight_g) END,
    height_cm          = CASE WHEN 'height_cm'          = ANY(v_locked) THEN p.height_cm          ELSE COALESCE(s.height_cm, p.height_cm) END,
    width_cm           = CASE WHEN 'width_cm'           = ANY(v_locked) THEN p.width_cm           ELSE COALESCE(s.width_cm, p.width_cm) END,
    length_cm          = CASE WHEN 'length_cm'          = ANY(v_locked) THEN p.length_cm          ELSE COALESCE(s.length_cm, p.length_cm) END,
    dimensions_display = CASE WHEN 'dimensions_display' = ANY(v_locked) THEN p.dimensions_display ELSE COALESCE(s.dimensions_display, p.dimensions_display) END,
    box_length_cm      = CASE WHEN 'box_length_cm'      = ANY(v_locked) THEN p.box_length_cm      ELSE COALESCE(s.box_length_cm, p.box_length_cm) END,
    box_width_cm       = CASE WHEN 'box_width_cm'       = ANY(v_locked) THEN p.box_width_cm       ELSE COALESCE(s.box_width_cm, p.box_width_cm) END,
    box_height_cm      = CASE WHEN 'box_height_cm'      = ANY(v_locked) THEN p.box_height_cm      ELSE COALESCE(s.box_height_cm, p.box_height_cm) END,
    box_weight_kg      = CASE WHEN 'box_weight_kg'      = ANY(v_locked) THEN p.box_weight_kg      ELSE COALESCE(s.box_weight_kg, p.box_weight_kg) END,
    box_volume_cm3     = CASE WHEN 'box_volume_cm3'     = ANY(v_locked) THEN p.box_volume_cm3     ELSE COALESCE(s.box_volume_cm3, p.box_volume_cm3) END,
    box_quantity       = CASE WHEN 'box_quantity'       = ANY(v_locked) THEN p.box_quantity       ELSE COALESCE(s.box_quantity, p.box_quantity) END,
    box_inner_quantity = CASE WHEN 'box_inner_quantity' = ANY(v_locked) THEN p.box_inner_quantity ELSE COALESCE(s.box_inner_quantity, p.box_inner_quantity) END,
    brand              = CASE WHEN 'brand'              = ANY(v_locked) THEN p.brand              ELSE COALESCE(s.brand, p.brand) END,
    packing_type       = CASE WHEN 'packing_type'       = ANY(v_locked) THEN p.packing_type       ELSE COALESCE(s.packing_type, p.packing_type) END,
    repacking_type     = CASE WHEN 'repacking_type'     = ANY(v_locked) THEN p.repacking_type     ELSE COALESCE(s.repacking_type, p.repacking_type) END,
    capacities         = CASE WHEN 'capacities'         = ANY(v_locked) THEN p.capacities         ELSE COALESCE(s.capacities, p.capacities) END,
    capacity_ml        = CASE WHEN 'capacity_ml'        = ANY(v_locked) THEN p.capacity_ml        ELSE COALESCE(s.capacity_ml, p.capacity_ml) END,
    min_quantity       = CASE WHEN 'min_quantity'       = ANY(v_locked) THEN p.min_quantity       ELSE COALESCE(s.min_quantity, p.min_quantity) END,
    warranty_months    = CASE WHEN 'warranty_months'    = ANY(v_locked) THEN p.warranty_months    ELSE COALESCE(s.warranty_months, p.warranty_months) END,
    ipi_rate           = CASE WHEN 'ipi_rate'           = ANY(v_locked) THEN p.ipi_rate           ELSE COALESCE(s.ipi_rate, p.ipi_rate) END,
    engraving_type     = CASE WHEN 'engraving_type'     = ANY(v_locked) THEN p.engraving_type     ELSE COALESCE(s.engraving_type, p.engraving_type) END,
    colors             = CASE WHEN 'colors'             = ANY(v_locked) THEN p.colors             ELSE COALESCE(s.colors, p.colors) END,
    is_active          = CASE WHEN 'is_active'          = ANY(v_locked) THEN p.is_active          ELSE COALESCE(s.is_active, p.is_active) END,
    last_sync_at          = now(),
    last_sync_supplier_id = s.supplier_id,
    supplier_updated_at   = now()
  WHERE p.id = v_pid;

  UPDATE public.produtos_padronizacao
     SET status='promoted', promoted_at=now(), product_id=v_pid
   WHERE id = p_id;

  IF s.raw_id IS NOT NULL THEN
    UPDATE public.supplier_products_raw
       SET status='processed', processed_at=now(), product_id=v_pid
     WHERE id = s.raw_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'product_id', v_pid, 'created', v_is_new,
                            'locked_preserved', v_locked);
END;
$function$;

-- 4) search_path explicito nas funcoes do pipeline que estavam sem (hardening,
--    sem mudanca de logica).
ALTER FUNCTION public.fn_standardize_raw(uuid, text)        SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.fn_standardize_parent(uuid, text)     SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.fn_promote_supplier(uuid, integer)    SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.fn_match_supplier_color(uuid, text, text, text, text) SET search_path TO 'public', 'extensions';