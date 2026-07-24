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
  IF v_pkey_field IS NULL THEN RETURN jsonb_build_object('error','sem parent_key_source'); END IF;

  SELECT array_agg(pkey) INTO v_keys FROM (
     SELECT raw_data->>v_pkey_field AS pkey
       FROM supplier_products_raw
      WHERE supplier_id=p_supplier_id AND NULLIF(raw_data->>v_pkey_field,'') IS NOT NULL
      GROUP BY raw_data->>v_pkey_field HAVING count(*) > 1
      ORDER BY count(*) DESC LIMIT p_parents
  ) t;

  SELECT jsonb_object_agg(ref, jsonb_build_object('name',name,'n_variantes',n,'amostra',amostra)) INTO v_before
  FROM (
     SELECT p.supplier_reference ref, p.name,
            (SELECT count(*) FROM product_variants v WHERE v.product_id=p.id) n,
            (SELECT jsonb_agg(jsonb_build_object('sku',x.sku,'sup_sku',x.supplier_sku,'cor',x.color_name,'attrs',x.attributes))
               FROM (SELECT sku,supplier_sku,color_name,attributes FROM product_variants
                      WHERE product_id=p.id ORDER BY sku LIMIT 3) x) amostra
       FROM products p WHERE p.supplier_id=p_supplier_id AND p.supplier_reference=ANY(v_keys)
  ) q;

  BEGIN
     UPDATE supplier_products_raw SET processed=false
      WHERE supplier_id=p_supplier_id AND raw_data->>v_pkey_field = ANY(v_keys);

     v_engine := fn_process_raw_v2(p_supplier_id, p_parents + 10);

     SELECT jsonb_object_agg(ref, jsonb_build_object('name',name,'n_variantes',n,'amostra',amostra)) INTO v_after
     FROM (
        SELECT p.supplier_reference ref, p.name,
               (SELECT count(*) FROM product_variants v WHERE v.product_id=p.id) n,
               (SELECT jsonb_agg(jsonb_build_object('sku',x.sku,'sup_sku',x.supplier_sku,'cor',x.color_name,'attrs',x.attributes))
                  FROM (SELECT sku,supplier_sku,color_name,attributes FROM product_variants
                         WHERE product_id=p.id ORDER BY sku LIMIT 3) x) amostra
          FROM products p WHERE p.supplier_id=p_supplier_id AND p.supplier_reference=ANY(v_keys)
     ) q;

     v_out := jsonb_build_object('keys',to_jsonb(v_keys),'engine',v_engine,'before',v_before,'after',v_after);
     RAISE EXCEPTION 'DRYRUN_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
     IF SQLERRM <> 'DRYRUN_ROLLBACK' THEN
        v_out := jsonb_build_object('keys',to_jsonb(v_keys),'erro_motor',SQLERRM,'before',v_before);
     END IF;
  END;
  RETURN v_out;
END $function$;