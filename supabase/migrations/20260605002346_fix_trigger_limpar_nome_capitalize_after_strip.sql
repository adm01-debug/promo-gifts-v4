
-- BUG-2 FIX: Re-capitalize first letter after limpar_nome_produto_spot strips the prefix
CREATE OR REPLACE FUNCTION public.trigger_limpar_nome_produto()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
DECLARE
    v_spot_supplier_id UUID := 'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0';
    v_result text;
BEGIN
    IF NEW.supplier_id = v_spot_supplier_id THEN
        v_result := limpar_nome_produto_spot(NEW.name);
        -- Re-capitalize first letter after prefix stripping
        IF v_result IS NOT NULL AND v_result <> '' THEN
            v_result := UPPER(LEFT(v_result, 1)) || SUBSTR(v_result, 2);
        END IF;
        NEW.name := v_result;
    END IF;
    
    RETURN NEW;
END;
$$;
