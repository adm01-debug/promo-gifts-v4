-- Harness de paridade: roda fn_process_raw_v2 numa amostra e REVERTE tudo (savepoint).
-- Não persiste nada no gold. Retorna before/after pra comparação campo-a-campo.
CREATE OR REPLACE FUNCTION public.fn_dryrun_raw_v2(p_supplier_id uuid, p_parents integer DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pkey_field text;
  v_keys       text[];
  v_before     jsonb;
  v_after      jsonb;
  v_engine     jsonb;
  v_out        jsonb;
BEGIN
  SELECT parent_key_source INTO v_pkey_field FROM supplier_settings WHERE supplier_id=p_supplier_id;
  IF v_pkey_field IS NULL THEN
     RETURN jsonb_build_object('error','sem parent_key_source configurado');
  END IF;

  -- amostra: parents com mais de uma linha raw (testa o agrupamento 1:N)
  SELECT array_agg(pkey) INTO v_keys FROM (
     SELECT raw_data->>v_pkey_field AS pkey
       FROM supplier_products_raw
      WHERE supplier_id=p_supplier_id AND NULLIF(raw_data->>v_pkey_field,'') IS NOT NULL
      GROUP BY raw_data->>v_pkey_field
      HAVING count(*) > 1
      ORDER BY count(*) DESC
      LIMIT p_parents
  ) t;

  -- BEFORE: gold atual desses parents
  SELECT jsonb_agg(jsonb_build_object(
            'ref', p.supplier_reference, 'name', p.name,
            'box_h_cm', p.box_height_cm,
            'variantes', (SELECT jsonb_agg(jsonb_build_object('sku',x.sku,'name',x.name,'cor',x.color_name,'attrs',x.attributes))
                          FROM (SELECT sku,name,color_name,attributes FROM product_variants
                                 WHERE product_id=p.id ORDER BY sku LIMIT 5) x)))
    INTO v_before
    FROM products p
   WHERE p.supplier_id=p_supplier_id AND p.supplier_reference = ANY(v_keys);

  BEGIN
     -- desmarca a amostra p/ o motor pegar
     UPDATE supplier_products_raw SET processed=false
      WHERE supplier_id=p_supplier_id AND raw_data->>v_pkey_field = ANY(v_keys);

     v_engine := fn_process_raw_v2(p_supplier_id, p_parents + 10);

     SELECT jsonb_agg(jsonb_build_object(
               'ref', p.supplier_reference, 'name', p.name,
               'box_h_cm', p.box_height_cm,
               'variantes', (SELECT jsonb_agg(jsonb_build_object('sku',x.sku,'name',x.name,'cor',x.color_name,'attrs',x.attributes))
                             FROM (SELECT sku,name,color_name,attributes FROM product_variants
                                    WHERE product_id=p.id ORDER BY sku LIMIT 5) x)))
       INTO v_after
       FROM products p
      WHERE p.supplier_id=p_supplier_id AND p.supplier_reference = ANY(v_keys);

     v_out := jsonb_build_object('keys',to_jsonb(v_keys),'engine',v_engine,'before',v_before,'after',v_after);
     RAISE EXCEPTION 'DRYRUN_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
     IF SQLERRM <> 'DRYRUN_ROLLBACK' THEN
        v_out := jsonb_build_object('keys',to_jsonb(v_keys),'erro_motor',SQLERRM,'before',v_before);
     END IF;
  END;

  RETURN v_out;
END $function$;