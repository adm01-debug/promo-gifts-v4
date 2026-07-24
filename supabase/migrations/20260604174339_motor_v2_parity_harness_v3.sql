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

  SELECT jsonb_object_agg(ref, jsonb_build_object(
            'name',name,'brand',brand,'origin',origin,'box_w',box_w,'box_q',box_q,
            'pack_class',pack_class,'main_cat',main_cat,'is_active',is_active,
            'n_locked',n_locked,'attrs_prod',attrs_prod,'n_variantes',nv,'amostra',amostra)) INTO v_before
  FROM (
     SELECT p.supplier_reference ref, p.name, p.brand, p.origin_country origin,
            p.box_weight_kg box_w, p.box_quantity box_q, p.packing_classification pack_class,
            p.main_category_id main_cat, p.is_active,
            COALESCE(array_length(p.locked_fields,1),0) n_locked, p.attributes attrs_prod,
            (SELECT count(*) FROM product_variants v WHERE v.product_id=p.id) nv,
            (SELECT jsonb_agg(jsonb_build_object('sku',x.sku,'sup_sku',x.supplier_sku,'cor',x.color_name,'attrs',x.attributes))
               FROM (SELECT sku,supplier_sku,color_name,attributes FROM product_variants
                      WHERE product_id=p.id ORDER BY sku LIMIT 2) x) amostra
       FROM products p WHERE p.supplier_id=p_supplier_id AND p.supplier_reference=ANY(v_keys)
  ) q;

  BEGIN
     UPDATE supplier_products_raw SET processed=false
      WHERE supplier_id=p_supplier_id AND raw_data->>v_pkey_field = ANY(v_keys);

     v_engine := fn_process_raw_v2(p_supplier_id, p_parents + 10);

     SELECT jsonb_object_agg(ref, jsonb_build_object(
               'name',name,'brand',brand,'origin',origin,'box_w',box_w,'box_q',box_q,
               'pack_class',pack_class,'main_cat',main_cat,'is_active',is_active,
               'n_locked',n_locked,'attrs_prod',attrs_prod,'n_variantes',nv,'amostra',amostra)) INTO v_after
     FROM (
        SELECT p.supplier_reference ref, p.name, p.brand, p.origin_country origin,
               p.box_weight_kg box_w, p.box_quantity box_q, p.packing_classification pack_class,
               p.main_category_id main_cat, p.is_active,
               COALESCE(array_length(p.locked_fields,1),0) n_locked, p.attributes attrs_prod,
               (SELECT count(*) FROM product_variants v WHERE v.product_id=p.id) nv,
               (SELECT jsonb_agg(jsonb_build_object('sku',x.sku,'sup_sku',x.supplier_sku,'cor',x.color_name,'attrs',x.attributes))
                  FROM (SELECT sku,supplier_sku,color_name,attributes FROM product_variants
                         WHERE product_id=p.id ORDER BY sku LIMIT 2) x) amostra
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