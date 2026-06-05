-- Overflow de campos texto da SPOT SEM alterar colunas (short_description e ncm_code são
-- referenciados por public.v_products_public e analytics.mv_product_cards; um ALTER TYPE exigiria
-- recriar esses objetos). Em vez disso, fn_apply_transform passa a truncar o resultado quando
-- transform_config.max_length está presente. Aditivo e opt-in: nenhum mapping existente usa
-- max_length, logo é backward-compatible para todos os fornecedores.
-- Dados reais: ShortDescription chega a 969 (col varchar(500)); Taric chega a 11 (col varchar(10)).
-- Ref.: docs/AUDITORIA_GAPS_CRITICOS_fn_process_raw_v2_2026-06-04.md

CREATE OR REPLACE FUNCTION public.fn_apply_transform(p_value text, p_transform_type character varying, p_transform_config jsonb, p_source_unit character varying, p_target_unit character varying, p_supplier_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
    v_result TEXT;
    v_numeric DECIMAL;
    v_multiplier DECIMAL;
    v_function_name VARCHAR;
    v_pattern TEXT;
    v_group INTEGER;
    v_matches TEXT[];
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
                v_numeric := p_value::DECIMAL;
                v_multiplier := COALESCE(
                    (p_transform_config->>'multiplier')::DECIMAL,
                    (p_transform_config->>'factor')::DECIMAL
                );
                v_result := TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM ROUND(v_numeric * v_multiplier, 4)::TEXT));
            EXCEPTION WHEN OTHERS THEN
                v_result := p_value;
            END;

        WHEN 'divide' THEN
            BEGIN
                v_numeric := p_value::DECIMAL;
                v_multiplier := COALESCE(
                    (p_transform_config->>'divisor')::DECIMAL,
                    (p_transform_config->>'factor')::DECIMAL
                );
                IF v_multiplier != 0 THEN
                    v_result := TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM ROUND(v_numeric / v_multiplier, 4)::TEXT));
                ELSE
                    v_result := p_value;
                END IF;
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
            v_result := fn_map_value(
                p_supplier_id,
                p_transform_config->>'lookup_type',
                p_value
            );

        WHEN 'custom' THEN
            BEGIN
                v_function_name := p_transform_config->>'function';
                CASE v_function_name
                    WHEN 'fn_parse_capacity_ml' THEN
                        v_result := fn_parse_capacity_ml(p_value)::TEXT;
                    WHEN 'fn_convert_box_dimension_to_cm' THEN
                        v_result := fn_convert_box_dimension_to_cm(p_value)::TEXT;
                    WHEN 'fn_clean_spot_name' THEN
                        v_result := fn_clean_spot_name(p_value);
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

        WHEN 'uppercase' THEN
            v_result := UPPER(p_value);

        WHEN 'lowercase' THEN
            v_result := LOWER(p_value);

        WHEN 'trim' THEN
            v_result := BTRIM(p_value);

        WHEN 'replace' THEN
            IF p_transform_config IS NOT NULL THEN
                v_result := REPLACE(
                    p_value,
                    COALESCE(p_transform_config->>'find', ''),
                    COALESCE(p_transform_config->>'replace', '')
                );
            ELSE
                v_result := p_value;
            END IF;

        WHEN 'regex_extract' THEN
            BEGIN
                v_pattern := p_transform_config->>'pattern';
                v_group := COALESCE((p_transform_config->>'group')::INTEGER, 1);
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

-- Caps para os dois campos que estouram com dados reais da SPOT.
UPDATE public.supplier_field_mappings
   SET transform_config = '{"max_length":500}'::jsonb, updated_at = now()
 WHERE supplier_id='bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0'::uuid
   AND target_table='products' AND target_field='short_description';

UPDATE public.supplier_field_mappings
   SET transform_config = '{"max_length":10}'::jsonb, updated_at = now()
 WHERE supplier_id='bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0'::uuid
   AND target_table='products' AND target_field='ncm_code';
