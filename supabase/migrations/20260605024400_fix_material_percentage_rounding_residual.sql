CREATE OR REPLACE FUNCTION public.fn_extract_materials_from_name(p_product_id uuid, p_replace_existing boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_product RECORD;
    v_material RECORD;
    v_count INTEGER := 0;
    v_search_text TEXT;
    v_org_id UUID := '5db5aee1-064b-4ef4-9193-345dcd8274ea';
    v_found_materials UUID[] := '{}';
    v_material_id UUID;
    v_percentage NUMERIC;
    v_n INTEGER;
    v_idx INTEGER;
    v_accumulated NUMERIC := 0;
BEGIN
    SELECT id, name, description, short_description, organization_id
    INTO v_product FROM products WHERE id = p_product_id;

    IF v_product.id IS NULL THEN RETURN 0; END IF;
    IF v_product.organization_id IS NOT NULL THEN v_org_id := v_product.organization_id; END IF;

    v_search_text := LOWER(COALESCE(v_product.name, '') || ' ' ||
                          COALESCE(v_product.description, '') || ' ' ||
                          COALESCE(v_product.short_description, ''));

    IF p_replace_existing THEN
        DELETE FROM product_materials WHERE product_id = p_product_id;
    ELSE
        IF EXISTS (SELECT 1 FROM product_materials WHERE product_id = p_product_id) THEN
            RETURN 0;
        END IF;
    END IF;

    FOR v_material IN SELECT mt.id, mt.name FROM material_types mt WHERE mt.is_active = true
    LOOP
        IF (
            (v_material.name = 'Alumínio' AND (v_search_text ILIKE '%alumínio%' OR v_search_text ILIKE '%aluminio%'))
            OR (v_material.name = 'Aço Inox' AND (v_search_text ILIKE '%aço inox%' OR v_search_text ILIKE '%inox%'))
            OR (v_material.name = 'Metal Genérico' AND (v_search_text ILIKE '%em metal%' OR v_search_text ILIKE '%e metal%' OR v_search_text ILIKE '% metal %'))
            OR (v_material.name = 'Zinco' AND v_search_text ILIKE '%zinco%')
            OR (v_material.name = 'Cobre' AND v_search_text ILIKE '%cobre%')
            OR (v_material.name = 'Bronze' AND v_search_text ILIKE '%bronze%')
            OR (v_material.name ILIKE '%ABS%' AND (v_search_text ILIKE '% abs %' OR v_search_text ILIKE '%e abs%' OR v_search_text ILIKE '%em abs%' OR v_search_text ILIKE '%rabs%'))
            OR (v_material.name ILIKE '%PVC%' AND (v_search_text ILIKE '%pvc%' OR v_search_text ILIKE '% pu %' OR v_search_text ILIKE '%em pu%'))
            OR (v_material.name = 'Policarbonato' AND (v_search_text ILIKE '%policarbonato%' OR v_search_text ILIKE '% pc %' OR v_search_text ILIKE '%em pc%'))
            OR (v_material.name = 'Polipropileno (PP)' AND (v_search_text ILIKE '%polipropileno%' OR v_search_text ILIKE '% pp %' OR v_search_text ILIKE '%em pp%'))
            OR (v_material.name = 'Poliestireno - PS' AND (v_search_text ILIKE '%poliestireno%' OR v_search_text ILIKE '% ps %' OR v_search_text ILIKE '%e ps%'))
            OR (v_material.name = 'Plástico - PET' AND (v_search_text ILIKE '% pet %' OR v_search_text ILIKE '%em pet%' OR v_search_text ILIKE '%rpet%'))
            OR (v_material.name = 'Plástico - rPET' AND v_search_text ILIKE '%rpet%')
            OR (v_material.name = 'Acrílico' AND (v_search_text ILIKE '%acrílico%' OR v_search_text ILIKE '%acrilico%'))
            OR (v_material.name = 'Silicone' AND v_search_text ILIKE '%silicone%')
            OR (v_material.name = 'Tritan' AND v_search_text ILIKE '%tritan%')
            OR (v_material.name = 'EVA (Acetato de Vinila)' AND v_search_text ILIKE '%eva%')
            OR (v_material.name = 'POE (Poliolefina Elastomérica)' AND (v_search_text ILIKE '% poe %' OR v_search_text ILIKE '%em poe%'))
            OR (v_material.name = 'Poliéster' AND (v_search_text ILIKE '%poliéster%' OR v_search_text ILIKE '%poliester%' OR v_search_text ILIKE '%300d%' OR v_search_text ILIKE '%600d%' OR v_search_text ILIKE '%1680d%'))
            OR (v_material.name = 'Algodão' AND (v_search_text ILIKE '%algodão%' OR v_search_text ILIKE '%algodao%' OR v_search_text ILIKE '%canvas%' OR v_search_text ILIKE '%camiseta%'))
            OR (v_material.name = 'Nylon' AND v_search_text ILIKE '%nylon%')
            OR (v_material.name = 'Pongee' AND v_search_text ILIKE '%pongee%')
            OR (v_material.name = 'Oxford' AND v_search_text ILIKE '%oxford%')
            OR (v_material.name = 'Ripstop' AND (v_search_text ILIKE '%ripstop%' OR v_search_text ILIKE '%210d%'))
            OR (v_material.name = 'Jacquard' AND (v_search_text ILIKE '%jacquard%' OR v_search_text ILIKE '%840d%'))
            OR (v_material.name = 'Polar' AND v_search_text ILIKE '%polar%')
            OR (v_material.name = 'Microfibra' AND v_search_text ILIKE '%microfibra%')
            OR (v_material.name = 'Feltro' AND v_search_text ILIKE '%feltro%')
            OR (v_material.name = 'TNT (Nowen)' AND (v_search_text ILIKE '%tnt%' OR v_search_text ILIKE '%non-woven%' OR v_search_text ILIKE '%nonwoven%'))
            OR (v_material.name = 'Neoprene' AND v_search_text ILIKE '%neoprene%')
            OR (v_material.name = 'Fibras Naturais' AND (v_search_text ILIKE '%palha%' OR v_search_text ILIKE '%juta%' OR v_search_text ILIKE '%fibras naturais%'))
            OR (v_material.name = 'Bambu' AND v_search_text ILIKE '%bambu%')
            OR (v_material.name = 'Madeira' AND v_search_text ILIKE '%madeira%')
            OR (v_material.name = 'MDF' AND v_search_text ILIKE '%mdf%')
            OR (v_material.name = 'Cortiça' AND (v_search_text ILIKE '%cortiça%' OR v_search_text ILIKE '%cortica%'))
            OR (v_material.name = 'Vidro Borossilicado' AND v_search_text ILIKE '%borossilicato%')
            OR (v_material.name = 'Vidro' AND v_search_text ILIKE '%vidro%' AND NOT v_search_text ILIKE '%borossilicato%')
            OR (v_material.name = 'Cerâmica' AND (v_search_text ILIKE '%cerâmica%' OR v_search_text ILIKE '%ceramica%'))
            OR (v_material.name = 'Porcelana' AND v_search_text ILIKE '%porcelana%')
            OR (v_material.name ILIKE '%Couro%' AND (v_search_text ILIKE '%couro%' OR v_search_text ILIKE '%pele%' OR v_search_text ILIKE '%c.sintético%'))
            OR (v_material.name = 'Cartão' AND (v_search_text ILIKE '%cartão%' OR v_search_text ILIKE '%cartao%' OR v_search_text ILIKE '%papel pedra%' OR v_search_text ILIKE '%em papel%'))
            OR (v_material.name = 'Kraft' AND v_search_text ILIKE '%kraft%')
            OR (v_material.name = 'Borracha' AND v_search_text ILIKE '%borracha%')
            OR (v_material.name = 'Espuma' AND v_search_text ILIKE '%espuma%')
        )
        THEN
            v_found_materials := array_append(v_found_materials, v_material.id);
        END IF;
    END LOOP;

    v_n := COALESCE(array_length(v_found_materials, 1), 0);
    IF v_n > 0 THEN
        -- Distribuição com resíduo: os (n-1) primeiros recebem ROUND(100/n,2);
        -- o último recebe (100 - soma acumulada) garantindo total exato = 100.
        v_percentage := ROUND(100.0 / v_n, 2);
        v_idx := 0;
        FOREACH v_material_id IN ARRAY v_found_materials LOOP
            v_idx := v_idx + 1;
            IF v_idx < v_n THEN
                INSERT INTO product_materials (organization_id, product_id, material_id, part, percentage, sort_order, is_active)
                VALUES (v_org_id, p_product_id, v_material_id, 'corpo', v_percentage, v_idx, true);
                v_accumulated := v_accumulated + v_percentage;
            ELSE
                INSERT INTO product_materials (organization_id, product_id, material_id, part, percentage, sort_order, is_active)
                VALUES (v_org_id, p_product_id, v_material_id, 'corpo', ROUND(100 - v_accumulated, 2), v_idx, true);
            END IF;
            v_count := v_count + 1;
        END LOOP;
    END IF;

    RETURN v_count;
END;
$function$;