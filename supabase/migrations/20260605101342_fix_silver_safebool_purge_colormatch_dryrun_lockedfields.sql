-- Fixes menores do pipeline Silver (auditoria PR #659).

-- fn_safe_bool: o fallback de excecao (unaccent indisponivel) perdia
-- active/inactive aceitos no caminho principal.
CREATE OR REPLACE FUNCTION public.fn_safe_bool(p text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v text;
BEGIN
  IF p IS NULL OR TRIM(p)='' THEN RETURN NULL; END IF;
  v := lower(unaccent(TRIM(p)));
  IF v IN ('sim','s','true','t','1','yes','y','ativo','active') THEN RETURN TRUE; END IF;
  IF v IN ('nao','n','false','f','0','no','inativo','inactive') THEN RETURN FALSE; END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  v := lower(TRIM(p));
  IF v IN ('sim','s','true','t','1','yes','y','ativo','active') THEN RETURN TRUE; END IF;
  IF v IN ('nao','não','n','false','f','0','no','inativo','inactive') THEN RETURN FALSE; END IF;
  RETURN NULL;
END; $function$;

-- fn_spr_history_purge: guard contra p_keep_months invalido (evita purga
-- agressiva acidental) + search_path.
CREATE OR REPLACE FUNCTION public.fn_spr_history_purge(p_keep_months integer DEFAULT 24)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v int;
BEGIN
  IF p_keep_months IS NULL OR p_keep_months < 1 THEN
    RAISE EXCEPTION 'p_keep_months deve ser >= 1 (recebido: %)', p_keep_months;
  END IF;
  WITH latest AS (
    SELECT DISTINCT ON (raw_id) id FROM public.supplier_products_raw_history
    ORDER BY raw_id, captured_at DESC
  ), del AS (
    DELETE FROM public.supplier_products_raw_history h
    WHERE h.captured_at < now() - make_interval(months => p_keep_months)
      AND h.id NOT IN (SELECT id FROM latest)
    RETURNING 1
  ) SELECT count(*) INTO v FROM del;
  RETURN v;
END;
$function$;

-- fn_match_canonical_color: normaliza p_name/p_hex (NULLIF de string vazia) para
-- nao priorizar nome em branco sobre match valido por hex + search_path.
CREATE OR REPLACE FUNCTION public.fn_match_canonical_color(p_name text, p_hex text)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_name_norm text := NULLIF(UPPER(TRIM(p_name)), '');
  v_hex_norm  text := NULLIF(UPPER(TRIM(p_hex)), '');
BEGIN
  IF v_name_norm IS NULL AND v_hex_norm IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT cv.id INTO v_id
  FROM public.color_variations cv
  WHERE cv.is_active = TRUE
    AND (
         (v_name_norm IS NOT NULL AND UPPER(TRIM(cv.name)) = v_name_norm)
      OR (v_hex_norm  IS NOT NULL AND UPPER(TRIM(cv.hex_code)) = v_hex_norm)
    )
  ORDER BY (CASE WHEN v_name_norm IS NOT NULL AND UPPER(TRIM(cv.name))=v_name_norm THEN 0 ELSE 1 END),
           cv.sort_order NULLS LAST
  LIMIT 1;
  RETURN v_id;
END;
$function$;

-- fn_dryrun_standardize_supplier: ignora parent_reference nulo e so conta
-- sucessos reais (contadores deixam de reportar sucesso falso) + search_path.
CREATE OR REPLACE FUNCTION public.fn_dryrun_standardize_supplier(p_supplier_id uuid, p_limit integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_raw RECORD; v_par RECORD; v_res jsonb;
  v_nvar int := 0; v_npai int := 0; v_t0 timestamptz := clock_timestamp();
BEGIN
  FOR v_raw IN
    SELECT id FROM public.supplier_products_raw
    WHERE supplier_id=p_supplier_id
    ORDER BY id
    LIMIT p_limit
  LOOP
    v_res := public.fn_standardize_variant(v_raw.id);
    IF COALESCE((v_res->>'success')::boolean, false) THEN v_nvar := v_nvar + 1; END IF;
  END LOOP;

  FOR v_par IN
    SELECT DISTINCT parent_reference FROM public.produtos_padronizacao_variantes
    WHERE supplier_id=p_supplier_id AND parent_reference IS NOT NULL
  LOOP
    v_res := public.fn_standardize_parent(p_supplier_id, v_par.parent_reference);
    IF COALESCE((v_res->>'success')::boolean, false) THEN v_npai := v_npai + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object('success',true,'supplier_id',p_supplier_id,
    'variantes_padronizadas',v_nvar,'pais_padronizados',v_npai,
    'segundos',round(extract(epoch FROM clock_timestamp()-v_t0)::numeric,1));
END;
$function$;

-- fn_products_capture_manual_edits: v_campos estava incompleto e nao protegia
-- edicoes manuais de box_*, repacking_type, capacities, capacity_ml, colors
-- (que a promocao silver->products sobrescreve). Alinhado a fn_promote_padronizacao.
CREATE OR REPLACE FUNCTION public.fn_products_capture_manual_edits()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_src text := current_setting('app.write_source', true);
  v_campos text[] := ARRAY[
    'name','description','short_description','sku','cost_price','sale_price','suggested_price',
    'primary_image_url','images','ncm_code','weight_g','height_cm','width_cm','length_cm',
    'dimensions_display','box_length_cm','box_width_cm','box_height_cm','box_weight_kg','box_volume_cm3',
    'box_quantity','box_inner_quantity','brand','packing_type','repacking_type','capacities','capacity_ml',
    'min_quantity','stock_quantity','is_active','warranty_months','ipi_rate','engraving_type','colors',
    'category_id','main_category_id'
  ];
  v_campo text;
  v_old jsonb := to_jsonb(OLD);
  v_new jsonb := to_jsonb(NEW);
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(v_src,'ui') <> 'pipeline' THEN
    FOREACH v_campo IN ARRAY v_campos LOOP
      IF (v_old -> v_campo) IS DISTINCT FROM (v_new -> v_campo) THEN
        IF NOT (v_campo = ANY(NEW.locked_fields)) THEN
          NEW.locked_fields := array_append(NEW.locked_fields, v_campo);
        END IF;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;