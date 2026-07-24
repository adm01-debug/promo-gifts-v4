-- ============================================================
-- MIGRAÇÃO: 20260604234600_restore_fn_clean_spot_name_branch.sql
-- DATA:     2026-06-04
-- MOTIVO:   🟠 REGRESSÃO de paridade. A migration out-of-band
--           `20260604232837_upgrade_fn_apply_transform_add_missing_transforms`
--           (presente no banco, AUSENTE do repo) recriou `fn_apply_transform`
--           (6-arg) e, ao fazê-lo, REMOVEU do CASE 'custom' o branch
--           `fn_clean_spot_name` que havia sido adicionado em
--           `fix_spot_name_cleaning` (DB 20260604214100). Restaram apenas
--           `fn_parse_capacity_ml` e `fn_convert_box_dimension_to_cm`.
--           Consequência: o mapping products.name (transform_type='custom',
--           function='fn_clean_spot_name') deixou de limpar o nome — produtos/
--           variantes novos nasceriam com o texto CRU do fornecedor (caixa alta,
--           espaços múltiplos), divergindo do acervo (sentence-case). Isto reverte
--           a correção do GAP-1 da auditoria de paridade process_spot_products.
--           Comprovado por teste E2E: Name '  CANECA   de   PORCELANA   BRANCA  '
--           gerava produto 'CANECA   de   PORCELANA   BRANCA' (sem limpeza).
-- SOLUÇÃO:  Recria `fn_apply_transform` preservando TODAS as transforms da 232837
--           (direct, multiply, divide, convert_unit, lookup, custom, prefix, suffix,
--           uppercase, lowercase, trim, replace, regex_extract) e RE-ADICIONA o
--           branch custom `fn_clean_spot_name`.
--           Pós-fix E2E: nome -> 'Caneca de porcelana branca'.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_apply_transform(
    p_value text,
    p_transform_type character varying,
    p_transform_config jsonb,
    p_source_unit character varying,
    p_target_unit character varying,
    p_supplier_id uuid
)
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

    RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION public.fn_apply_transform(text, varchar, jsonb, varchar, varchar, uuid) IS
'Transform pipeline v2.2 — restaura branch custom fn_clean_spot_name (revertido pela 232837). Inclui: direct, multiply, divide, convert_unit, lookup, custom(fn_parse_capacity_ml|fn_convert_box_dimension_to_cm|fn_clean_spot_name), prefix, suffix, uppercase, lowercase, trim, replace, regex_extract';
