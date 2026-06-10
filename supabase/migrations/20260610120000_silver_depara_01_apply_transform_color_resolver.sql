-- ════════════════════════════════════════════════════════════════
-- SILVER DE-PARA — Fase 1/6: motor de transformação
-- Follow-up do ADR 0007 (ver ADR 0008): trazer TODA a normalização de
-- variante para o de-para (supplier_field_mappings + fn_apply_transform),
-- eliminando os blocos hardcoded por fornecedor em fn_standardize_variant.
--
-- Esta migration é ADITIVA: recria fn_apply_transform a partir do corpo
-- ATUAL (20260605020240) e apenas acrescenta um resolver `custom`:
--   fn_extract_color_from_title  → usado pelo de-para de cor de Só Marcas
--                                  (que não tem campo de cor; deriva do título).
-- Nenhum branch existente é alterado.
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_apply_transform(p_value text, p_transform_type character varying, p_transform_config jsonb, p_source_unit character varying, p_target_unit character varying, p_supplier_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
    v_result     TEXT;
    v_numeric    DECIMAL;
    v_multiplier DECIMAL;
    v_fn         VARCHAR;
    v_pattern    TEXT;
    v_group      INTEGER;
    v_matches    TEXT[];
    v_max_length INTEGER;
BEGIN
    IF p_value IS NULL OR TRIM(p_value) = '' THEN
        RETURN NULL;
    END IF;

    CASE p_transform_type

        WHEN 'direct' THEN
            v_result := p_value;

        WHEN 'multiply' THEN
            BEGIN
                v_multiplier := COALESCE(
                    (p_transform_config->>'multiplier')::DECIMAL,
                    (p_transform_config->>'factor')::DECIMAL
                );
                IF v_multiplier IS NULL THEN
                    RETURN p_value;
                END IF;
                v_numeric := p_value::DECIMAL;
                v_result := TRIM(TRAILING '.' FROM
                              TRIM(TRAILING '0' FROM
                                ROUND(v_numeric * v_multiplier, 4)::TEXT));
            EXCEPTION WHEN OTHERS THEN
                v_result := p_value;
            END;

        WHEN 'divide' THEN
            BEGIN
                v_multiplier := COALESCE(
                    (p_transform_config->>'divisor')::DECIMAL,
                    (p_transform_config->>'factor')::DECIMAL
                );
                IF v_multiplier IS NULL OR v_multiplier = 0 THEN
                    RETURN p_value;
                END IF;
                v_numeric := p_value::DECIMAL;
                v_result := TRIM(TRAILING '.' FROM
                              TRIM(TRAILING '0' FROM
                                ROUND(v_numeric / v_multiplier, 4)::TEXT));
            EXCEPTION WHEN OTHERS THEN
                v_result := p_value;
            END;

        WHEN 'convert_unit' THEN
            BEGIN
                v_numeric := p_value::DECIMAL;
                v_result := fn_convert_unit(v_numeric, p_source_unit, p_target_unit, p_supplier_id)::TEXT;
            EXCEPTION WHEN OTHERS THEN
                v_result := p_value;
            END;

        WHEN 'lookup' THEN
            v_result := fn_map_value(p_supplier_id, p_transform_config->>'lookup_type', p_value);

        WHEN 'custom' THEN
            BEGIN
                v_fn := p_transform_config->>'function';
                CASE v_fn
                    WHEN 'fn_parse_capacity_ml' THEN
                        v_result := fn_parse_capacity_ml(p_value)::TEXT;
                    WHEN 'fn_convert_box_dimension_to_cm' THEN
                        v_result := fn_convert_box_dimension_to_cm(p_value)::TEXT;
                    WHEN 'fn_clean_spot_name' THEN
                        v_result := fn_clean_spot_name(p_value);
                    WHEN 'fn_extract_color_from_title' THEN
                        v_result := fn_extract_color_from_title(p_value);
                    ELSE
                        v_result := p_value;
                END CASE;
            EXCEPTION WHEN OTHERS THEN
                v_result := p_value;
            END;

        WHEN 'prefix' THEN
            IF p_transform_config IS NOT NULL AND p_transform_config->>'prefix' IS NOT NULL THEN
                v_result := (p_transform_config->>'prefix') || p_value;
            ELSE
                v_result := p_value;
            END IF;

        WHEN 'suffix' THEN
            IF p_transform_config IS NOT NULL AND p_transform_config->>'suffix' IS NOT NULL THEN
                v_result := p_value || (p_transform_config->>'suffix');
            ELSE
                v_result := p_value;
            END IF;

        WHEN 'uppercase'    THEN v_result := UPPER(p_value);
        WHEN 'lowercase'    THEN v_result := LOWER(p_value);
        WHEN 'trim'         THEN v_result := BTRIM(p_value);

        WHEN 'replace' THEN
            IF p_transform_config IS NOT NULL THEN
                v_result := REPLACE(p_value,
                    COALESCE(p_transform_config->>'find', ''),
                    COALESCE(p_transform_config->>'replace', ''));
            ELSE
                v_result := p_value;
            END IF;

        WHEN 'regex_extract' THEN
            BEGIN
                v_pattern := p_transform_config->>'pattern';
                v_group   := COALESCE((p_transform_config->>'group')::INTEGER, 1);
                IF v_pattern IS NULL THEN RETURN p_value; END IF;
                v_matches := regexp_matches(p_value, v_pattern);
                IF array_length(v_matches, 1) >= v_group THEN
                    v_result := v_matches[v_group];
                ELSE
                    v_result := NULL;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                v_result := p_value;
            END;

        ELSE
            v_result := p_value;

    END CASE;

    -- Aditivo: trunca para caber na coluna de destino quando configurado.
    IF v_result IS NOT NULL AND p_transform_config IS NOT NULL
       AND (p_transform_config->>'max_length') IS NOT NULL THEN
        v_max_length := (p_transform_config->>'max_length')::INTEGER;
        IF v_max_length > 0 AND length(v_result) > v_max_length THEN
            v_result := left(v_result, v_max_length);
        END IF;
    END IF;

    RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION public.fn_apply_transform(text, varchar, jsonb, varchar, varchar, uuid) IS
  'Motor de-para de valor único. transform_type ∈ {direct,multiply,divide,convert_unit,lookup,custom,prefix,suffix,uppercase,lowercase,trim,replace,regex_extract}. '
  'custom.function ∈ {fn_parse_capacity_ml,fn_convert_box_dimension_to_cm,fn_clean_spot_name,fn_extract_color_from_title}. max_length trunca o resultado.';
