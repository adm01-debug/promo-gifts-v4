CREATE OR REPLACE FUNCTION public.fn_process_raw_v2(
    p_supplier_id uuid,
    p_batch_size  integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_org_id            uuid;
    v_parent_key_source text;
    v_name_template     text;
    v_sku_prefix        text;
    v_prep              jsonb;
    v_parent            record;
    v_row               record;
    v_map               record;
    v_product_id        uuid;
    v_variant_id        uuid;
    v_vss_id            uuid;
    v_val               text;
    v_tv                text;
    v_parts             text[];
    v_vfields           jsonb;
    v_ssfields          jsonb;
    v_name              text;
    v_attrs             jsonb;
    v_sku               text;
    v_sup_sku           text;
    v_k                 text;
    v_v                 text;
    v_parents           integer := 0;
    v_variants          integer := 0;
    v_errors            jsonb := '[]'::jsonb;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT is_admin_or_above((SELECT auth.uid())) THEN
        RAISE EXCEPTION 'Acesso negado: requer perfil admin ou superior';
    END IF;

    SELECT organization_id INTO v_org_id FROM suppliers WHERE id = p_supplier_id;

    SELECT parent_key_source, variant_name_template, sku_prefix
      INTO v_parent_key_source, v_name_template, v_sku_prefix
      FROM supplier_settings WHERE supplier_id = p_supplier_id;

    IF v_parent_key_source IS NULL THEN
        RETURN jsonb_build_object('success', false,
            'error', 'supplier_settings.parent_key_source ausente para o fornecedor '||p_supplier_id);
    END IF;
    v_name_template := COALESCE(v_name_template, '{product_name}');

    FOR v_parent IN
        SELECT DISTINCT raw_data->>v_parent_key_source AS pkey
          FROM supplier_products_raw
         WHERE supplier_id = p_supplier_id AND processed = false
           AND NULLIF(raw_data->>v_parent_key_source,'') IS NOT NULL
         LIMIT p_batch_size
    LOOP
      BEGIN
        -- 1) Produto: achar ou criar por (supplier_id, supplier_reference = chave do pai)
        SELECT id INTO v_product_id
          FROM products
         WHERE supplier_id = p_supplier_id AND supplier_reference = v_parent.pkey;

        IF v_product_id IS NULL THEN
            INSERT INTO products (organization_id, supplier_id, supplier_reference, sku, name,
                                  active, is_active, sync_status, created_at, updated_at)
            VALUES (v_org_id, p_supplier_id, v_parent.pkey,
                    COALESCE(v_sku_prefix,'')||v_parent.pkey,
                    'Produto '||v_parent.pkey, true, true, 'processing', now(), now())
            RETURNING id INTO v_product_id;
        END IF;

        SELECT raw_data INTO v_prep
          FROM supplier_products_raw
         WHERE supplier_id=p_supplier_id AND processed=false
           AND raw_data->>v_parent_key_source = v_parent.pkey
         ORDER BY imported_at NULLS LAST LIMIT 1;

        -- 2) Campos de produto
        v_parts := ARRAY[]::text[];
        FOR v_map IN
            SELECT * FROM supplier_field_mappings
             WHERE supplier_id=p_supplier_id AND target_table='products' AND is_active=true
             ORDER BY priority
        LOOP
            v_val := CASE WHEN v_map.source_path IS NOT NULL
                          THEN v_prep #>> string_to_array(v_map.source_path,'.')
                          ELSE v_prep ->> v_map.source_field END;
            CONTINUE WHEN v_val IS NULL OR btrim(v_val)='';
            v_tv := fn_apply_transform(v_val, v_map.transform_type, v_map.transform_config,
                                       v_map.source_unit, v_map.target_unit, p_supplier_id);
            IF v_tv IS NOT NULL THEN
                v_parts := array_append(v_parts, format('%I = %L', v_map.target_field, v_tv));
            END IF;
        END LOOP;

        IF array_length(v_parts,1) > 0 THEN
            EXECUTE format(
              'UPDATE products SET %s, updated_at=now(), sync_status=''synced'', last_sync_at=now(), last_sync_supplier_id=%L WHERE id=%L',
              array_to_string(v_parts,', '), p_supplier_id, v_product_id);
        END IF;

        UPDATE products
           SET dimensions_display = fn_format_dimensions_display(length_cm, width_cm, height_cm)
         WHERE id = v_product_id AND length_cm IS NOT NULL;

        -- 3) Variantes
        FOR v_row IN
            SELECT * FROM supplier_products_raw
             WHERE supplier_id=p_supplier_id AND processed=false
               AND raw_data->>v_parent_key_source = v_parent.pkey
        LOOP
          BEGIN
            v_vfields := '{}'::jsonb;
            FOR v_map IN
                SELECT * FROM supplier_field_mappings
                 WHERE supplier_id=p_supplier_id AND target_table='product_variants' AND is_active=true
                 ORDER BY priority
            LOOP
                v_val := CASE WHEN v_map.source_path IS NOT NULL
                              THEN v_row.raw_data #>> string_to_array(v_map.source_path,'.')
                              ELSE v_row.raw_data ->> v_map.source_field END;
                CONTINUE WHEN v_val IS NULL OR btrim(v_val)='';
                v_tv := fn_apply_transform(v_val, v_map.transform_type, v_map.transform_config,
                                           v_map.source_unit, v_map.target_unit, p_supplier_id);
                IF v_tv IS NOT NULL THEN
                    v_vfields := v_vfields || jsonb_build_object(v_map.target_field, v_tv);
                END IF;
            END LOOP;

            -- Nome via template + attributes de cor
            v_name := replace(v_name_template, '{product_name}',
                              COALESCE((SELECT name FROM products WHERE id=v_product_id),''));
            v_name := replace(v_name, '{color_name}', COALESCE(v_vfields->>'color_name',''));
            v_name := btrim(regexp_replace(v_name, '\s*[|-]\s*$', ''));
            v_attrs := jsonb_build_object('codigo_cor', COALESCE(v_vfields->>'color_code',''),
                                          'cor',        COALESCE(v_vfields->>'color_name',''));

            -- IDENTIDADE = supplier_sku (chave estável do fornecedor); preserva o SKU público existente
            v_sup_sku := NULLIF(v_row.supplier_sku, '');
            v_variant_id := NULL;
            IF v_sup_sku IS NOT NULL THEN
                SELECT id INTO v_variant_id FROM product_variants
                 WHERE product_id = v_product_id AND supplier_sku = v_sup_sku;
            END IF;

            IF v_variant_id IS NULL THEN
                -- Variante nova: SKU público = mapping 'sku' (se houver) > supplier_sku > supplier_reference
                v_sku := COALESCE(v_vfields->>'sku', v_sup_sku, v_row.supplier_reference);
                INSERT INTO product_variants (product_id, sku, supplier_sku, name,
                                              color_code, color_name, color_hex, attributes, is_active, created_at, updated_at)
                VALUES (v_product_id, v_sku, v_sup_sku, v_name,
                        v_vfields->>'color_code', v_vfields->>'color_name', v_vfields->>'color_hex',
                        v_attrs, true, now(), now())
                ON CONFLICT (sku) DO UPDATE SET
                    supplier_sku=EXCLUDED.supplier_sku, name=EXCLUDED.name, color_code=EXCLUDED.color_code,
                    color_name=EXCLUDED.color_name, color_hex=EXCLUDED.color_hex, attributes=EXCLUDED.attributes,
                    updated_at=now()
                RETURNING id INTO v_variant_id;
            ELSE
                -- Variante existente: preserva o SKU público do gold, atualiza o resto
                UPDATE product_variants SET
                    name=v_name, color_code=v_vfields->>'color_code', color_name=v_vfields->>'color_name',
                    color_hex=v_vfields->>'color_hex', attributes=v_attrs, updated_at=now()
                WHERE id=v_variant_id;
            END IF;

            -- Demais campos de variante (size_code, capacity_ml, …) via UPDATE dinâmico
            v_parts := ARRAY[]::text[];
            FOR v_k, v_v IN
                SELECT key, value FROM jsonb_each_text(
                    v_vfields - 'sku' - 'supplier_sku' - 'color_code' - 'color_name' - 'color_hex')
            LOOP
                v_parts := array_append(v_parts, format('%I = %L', v_k, v_v));
            END LOOP;
            IF array_length(v_parts,1) > 0 THEN
                EXECUTE format('UPDATE product_variants SET %s, updated_at=now() WHERE id=%L',
                               array_to_string(v_parts,', '), v_variant_id);
            END IF;

            -- variant_supplier_sources (custo/estoque)
            v_ssfields := '{}'::jsonb;
            FOR v_map IN
                SELECT * FROM supplier_field_mappings
                 WHERE supplier_id=p_supplier_id AND target_table='variant_supplier_sources' AND is_active=true
                 ORDER BY priority
            LOOP
                v_val := CASE WHEN v_map.source_path IS NOT NULL
                              THEN v_row.raw_data #>> string_to_array(v_map.source_path,'.')
                              ELSE v_row.raw_data ->> v_map.source_field END;
                CONTINUE WHEN v_val IS NULL OR btrim(v_val)='';
                v_tv := fn_apply_transform(v_val, v_map.transform_type, v_map.transform_config,
                                           v_map.source_unit, v_map.target_unit, p_supplier_id);
                IF v_tv IS NOT NULL THEN
                    v_ssfields := v_ssfields || jsonb_build_object(v_map.target_field, v_tv);
                END IF;
            END LOOP;

            IF v_ssfields <> '{}'::jsonb THEN
                SELECT id INTO v_vss_id FROM variant_supplier_sources
                 WHERE variant_id=v_variant_id AND supplier_id=p_supplier_id;
                IF v_vss_id IS NULL THEN
                    INSERT INTO variant_supplier_sources (organization_id, variant_id, supplier_id, supplier_sku,
                                                          cost_price, quantity, source, is_preferred, is_active, updated_at)
                    VALUES (v_org_id, v_variant_id, p_supplier_id, v_sup_sku,
                            NULLIF(v_ssfields->>'cost_price','')::numeric,
                            COALESCE(NULLIF(v_ssfields->>'quantity','')::integer, 0),
                            'raw_v2', true, true, now());
                ELSE
                    UPDATE variant_supplier_sources SET
                        cost_price = COALESCE(NULLIF(v_ssfields->>'cost_price','')::numeric, cost_price),
                        quantity   = COALESCE(NULLIF(v_ssfields->>'quantity','')::integer, quantity),
                        updated_at = now()
                    WHERE id=v_vss_id;
                END IF;
            END IF;

            UPDATE supplier_products_raw
               SET processed=true, processed_at=now(), product_id=v_product_id, variant_id=v_variant_id
             WHERE id=v_row.id;
            v_variants := v_variants + 1;

          EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors || jsonb_build_object('raw_id', v_row.id, 'stage','variant', 'error', SQLERRM);
          END;
        END LOOP;

        v_parents := v_parents + 1;
      EXCEPTION WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_object('parent_key', v_parent.pkey, 'stage','parent', 'error', SQLERRM);
      END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 'supplier_id', p_supplier_id,
        'parents_processed', v_parents, 'variants_processed', v_variants, 'errors', v_errors);
END;
$function$;