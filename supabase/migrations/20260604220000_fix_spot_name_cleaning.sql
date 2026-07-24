-- ============================================================
-- MIGRAÇÃO: 20260604220000_fix_spot_name_cleaning.sql
-- DATA:     2026-06-04
-- MOTIVO:   Auditoria process_spot_products -> fn_process_raw_v2 (GAP 🟠).
--           A função legada aplicava clean_spot_name(Name) ao nome do
--           produto; na v2 o mapping products.name era 'direct' (texto cru).
--           clean_spot_name era órfã de produção e foi removida.
-- EVIDÊNCIA: 1200/1200 produtos SPOT estão em "sentence-case"
--           (1ª letra maiúscula, restante minúsculo, espaços colapsados).
-- SOLUÇÃO:  recriar como fn_clean_spot_name e ligar via transform 'custom'
--           no mapping products.name.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_clean_spot_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
    SELECT CASE
        WHEN s IS NULL OR s = '' THEN NULLIF(s, '')
        ELSE upper(left(s, 1)) || lower(substr(s, 2))
    END
    FROM (SELECT btrim(regexp_replace(p_name, '\s+', ' ', 'g')) AS s) t;
$$;

COMMENT ON FUNCTION public.fn_clean_spot_name(text) IS
    '2026-06-04: Normaliza nome de produto SPOT em sentence-case (colapsa espaços, trim, 1ª letra maiúscula e resto minúsculo). Reimplementa a antiga clean_spot_name (órfã/removida) para o pipeline fn_process_raw_v2.';

-- Adicionar o branch fn_clean_spot_name ao CASE 'custom' de fn_apply_transform
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
                v_multiplier := (p_transform_config->>'multiplier')::DECIMAL;
                v_result := TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM ROUND(v_numeric * v_multiplier, 4)::TEXT));
            EXCEPTION WHEN OTHERS THEN
                v_result := p_value;
            END;

        WHEN 'divide' THEN
            BEGIN
                v_numeric := p_value::DECIMAL;
                v_multiplier := (p_transform_config->>'divisor')::DECIMAL;
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

        ELSE
            v_result := p_value;

    END CASE;

    RETURN v_result;
END;
$function$;

-- Ligar o mapping products.name ao transform custom de limpeza
UPDATE supplier_field_mappings
   SET transform_type = 'custom',
       transform_config = jsonb_build_object('function', 'fn_clean_spot_name')
 WHERE supplier_id = 'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0'
   AND target_table = 'products'
   AND target_field = 'name';
