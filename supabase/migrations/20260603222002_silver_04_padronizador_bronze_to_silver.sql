
-- ════════════════════════════════════════════════════════════════
-- PADRONIZADOR bronze → silver
-- Lê supplier_products_raw, aplica o de-para (supplier_field_mappings)
-- + equivalências, e grava produtos_padronizacao JÁ PADRONIZADO.
-- Correções embutidas: NCM sempre via fn_normalize_ncm (resolve bug Asia).
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_standardize_raw(p_raw_id uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  r          public.supplier_products_raw%ROWTYPE;
  m          RECORD;
  v_val      text;
  v_tx       text;
  v_assigns  jsonb := '{}'::jsonb;   -- coluna→valor acumulado (campos de products)
  v_errs     jsonb := '[]'::jsonb;
  v_ncm      text;
  v_ncm_raw  text;
  v_pad_id   uuid;
  v_cols     text[] := ARRAY[
    'name','description','short_description','cost_price','suggested_price','stock_quantity',
    'primary_image_url','images','ncm_code','weight_g','height_cm','width_cm','length_cm',
    'dimensions_display','box_length_cm','box_width_cm','box_height_cm','box_weight_kg',
    'box_volume_cm3','box_quantity','box_inner_quantity','brand','packing_type','repacking_type',
    'capacities','capacity_ml','min_quantity','warranty_months','ipi_rate','engraving_type','is_active'
  ];
BEGIN
  SELECT * INTO r FROM public.supplier_products_raw WHERE id = p_raw_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'raw_nao_encontrado', 'id', p_raw_id);
  END IF;

  -- Aplica o de-para do fornecedor, somente para alvos em products
  -- e somente para colunas que a silver carrega (núcleo de ingestão).
  FOR m IN
    SELECT source_field, source_path, target_field, transform_type, transform_config,
           source_unit, target_unit
    FROM public.supplier_field_mappings
    WHERE supplier_id = r.supplier_id AND target_table = 'products' AND is_active = TRUE
      AND target_field = ANY(v_cols)
    ORDER BY priority
  LOOP
    -- extrai valor cru (campo direto ou caminho aninhado)
    IF m.source_path IS NOT NULL THEN
      v_val := r.raw_data #>> string_to_array(m.source_path, '.');
    ELSE
      v_val := r.raw_data ->> m.source_field;
    END IF;
    CONTINUE WHEN v_val IS NULL OR TRIM(v_val) = '';

    -- transforma usando a engine existente
    BEGIN
      v_tx := public.fn_apply_transform(v_val, m.transform_type, m.transform_config,
                                        m.source_unit, m.target_unit, r.supplier_id);
    EXCEPTION WHEN OTHERS THEN
      v_tx := v_val;
      v_errs := v_errs || jsonb_build_object('field', m.target_field, 'stage', 'transform', 'msg', SQLERRM);
    END;

    IF v_tx IS NOT NULL THEN
      v_assigns := v_assigns || jsonb_build_object(m.target_field, v_tx);
    END IF;
  END LOOP;

  -- ── CORREÇÃO NCM (resolve o bug Asia: jsonpath gravava com pontos) ──
  v_ncm_raw := COALESCE(v_assigns->>'ncm_code', r.raw_data->>'ncm', r.raw_data->>'Ncm');
  v_ncm := public.fn_normalize_ncm(v_ncm_raw);   -- 8 dígitos, sem ponto, ou NULL se inválido
  IF v_ncm IS NOT NULL THEN
    v_assigns := v_assigns || jsonb_build_object('ncm_code', v_ncm);
  ELSIF v_ncm_raw IS NOT NULL THEN
    v_errs := v_errs || jsonb_build_object('field','ncm_code','stage','validate','msg','ncm_invalido','raw',v_ncm_raw);
    v_assigns := v_assigns - 'ncm_code';  -- não promove NCM inválido
  END IF;

  -- ── UPSERT na silver, materializando o jsonb acumulado em colunas tipadas ──
  INSERT INTO public.produtos_padronizacao AS pad (
    raw_id, supplier_id, supplier_reference,
    name, description, short_description, cost_price, suggested_price, stock_quantity,
    primary_image_url, images, ncm_code, weight_g, height_cm, width_cm, length_cm,
    dimensions_display, box_length_cm, box_width_cm, box_height_cm, box_weight_kg,
    box_volume_cm3, box_quantity, box_inner_quantity, brand, packing_type, repacking_type,
    capacities, capacity_ml, min_quantity, warranty_months, ipi_rate, engraving_type, is_active,
    status, validation_errors, standardized_at
  ) VALUES (
    r.id, r.supplier_id, r.supplier_reference,
    v_assigns->>'name', v_assigns->>'description', v_assigns->>'short_description',
    (v_assigns->>'cost_price')::numeric, (v_assigns->>'suggested_price')::numeric, (v_assigns->>'stock_quantity')::integer,
    v_assigns->>'primary_image_url',
    CASE WHEN v_assigns ? 'images' THEN (v_assigns->'images') ELSE NULL END,
    v_assigns->>'ncm_code', (v_assigns->>'weight_g')::integer,
    (v_assigns->>'height_cm')::numeric, (v_assigns->>'width_cm')::numeric, (v_assigns->>'length_cm')::numeric,
    v_assigns->>'dimensions_display',
    (v_assigns->>'box_length_cm')::numeric, (v_assigns->>'box_width_cm')::numeric, (v_assigns->>'box_height_cm')::numeric,
    (v_assigns->>'box_weight_kg')::numeric, (v_assigns->>'box_volume_cm3')::numeric,
    (v_assigns->>'box_quantity')::integer, (v_assigns->>'box_inner_quantity')::integer,
    v_assigns->>'brand', v_assigns->>'packing_type', v_assigns->>'repacking_type',
    v_assigns->>'capacities', (v_assigns->>'capacity_ml')::integer, (v_assigns->>'min_quantity')::integer,
    (v_assigns->>'warranty_months')::integer, (v_assigns->>'ipi_rate')::numeric, v_assigns->>'engraving_type',
    COALESCE((v_assigns->>'is_active')::boolean, true),
    CASE WHEN jsonb_array_length(v_errs) > 0 AND v_assigns->>'name' IS NULL THEN 'rejected' ELSE 'standardized' END,
    CASE WHEN jsonb_array_length(v_errs) > 0 THEN v_errs ELSE NULL END,
    now()
  )
  ON CONFLICT (supplier_id, supplier_reference) DO UPDATE SET
    raw_id=EXCLUDED.raw_id, name=EXCLUDED.name, description=EXCLUDED.description,
    short_description=EXCLUDED.short_description, cost_price=EXCLUDED.cost_price,
    suggested_price=EXCLUDED.suggested_price, stock_quantity=EXCLUDED.stock_quantity,
    primary_image_url=EXCLUDED.primary_image_url, images=EXCLUDED.images, ncm_code=EXCLUDED.ncm_code,
    weight_g=EXCLUDED.weight_g, height_cm=EXCLUDED.height_cm, width_cm=EXCLUDED.width_cm, length_cm=EXCLUDED.length_cm,
    dimensions_display=EXCLUDED.dimensions_display, box_length_cm=EXCLUDED.box_length_cm, box_width_cm=EXCLUDED.box_width_cm,
    box_height_cm=EXCLUDED.box_height_cm, box_weight_kg=EXCLUDED.box_weight_kg, box_volume_cm3=EXCLUDED.box_volume_cm3,
    box_quantity=EXCLUDED.box_quantity, box_inner_quantity=EXCLUDED.box_inner_quantity, brand=EXCLUDED.brand,
    packing_type=EXCLUDED.packing_type, repacking_type=EXCLUDED.repacking_type, capacities=EXCLUDED.capacities,
    capacity_ml=EXCLUDED.capacity_ml, min_quantity=EXCLUDED.min_quantity, warranty_months=EXCLUDED.warranty_months,
    ipi_rate=EXCLUDED.ipi_rate, engraving_type=EXCLUDED.engraving_type, is_active=EXCLUDED.is_active,
    status=EXCLUDED.status, validation_errors=EXCLUDED.validation_errors, standardized_at=now(), updated_at=now()
  RETURNING pad.id INTO v_pad_id;

  RETURN jsonb_build_object('success', true, 'padronizacao_id', v_pad_id,
                            'campos', (SELECT count(*) FROM jsonb_object_keys(v_assigns)),
                            'erros', v_errs);
END;
$$;

COMMENT ON FUNCTION public.fn_standardize_raw(uuid) IS
  'Padronizador bronze→silver: aplica de-para + equivalências, normaliza NCM, grava produtos_padronizacao.';
