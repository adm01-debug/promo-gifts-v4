
-- CRITICAL FIX: fn_process_raw_v2 v2.2 — migra de processed (bool) para status (enum)
-- Status enum: pending, processing, processed, failed, skipped, quarantined
CREATE OR REPLACE FUNCTION public.fn_process_raw_v2(
    p_supplier_id uuid,
    p_batch_size integer DEFAULT 100,
    p_bulk_mode boolean DEFAULT true
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
    v_locked            text[];
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
    v_batch_id          uuid := gen_random_uuid();
    v_started           timestamptz := now();
    v_perr              integer := 0;
    v_verr              integer := 0;
    v_batch_open        boolean := false;
    v_pending_count     integer := 0;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT is_admin_or_above((SELECT auth.uid())) THEN
        RAISE EXCEPTION 'Acesso negado: requer perfil admin ou superior';
    END IF;

    PERFORM set_config('app.write_source', 'pipeline', true);
    PERFORM set_config('app.bulk_import_mode', p_bulk_mode::text, true);

    SELECT organization_id INTO v_org_id FROM suppliers WHERE id = p_supplier_id;

    SELECT parent_key_source, variant_name_template, sku_prefix
      INTO v_parent_key_source, v_name_template, v_sku_prefix
      FROM supplier_settings WHERE supplier_id = p_supplier_id;

    IF v_parent_key_source IS NULL THEN
        RETURN jsonb_build_object('success', false,
            'error', 'supplier_settings.parent_key_source ausente para o fornecedor '||p_supplier_id);
    END IF;
    v_name_template := COALESCE(v_name_template, '{product_name}');

    -- Contar pendentes (status = 'pending') — anti-zumbi
    SELECT COUNT(DISTINCT raw_data->>v_parent_key_source)
      INTO v_pending_count
      FROM supplier_products_raw
     WHERE supplier_id = p_supplier_id
       AND status = 'pending'
       AND NULLIF(raw_data->>v_parent_key_source, '') IS NOT NULL;

    IF v_pending_count = 0 THEN
        RETURN jsonb_build_object(
            'success', true, 'supplier_id', p_supplier_id,
            'batch_id', NULL, 'parents_processed', 0, 'variants_processed', 0,
            'message', 'Nenhuma linha pendente encontrada');
    END IF;

    INSERT INTO supplier_import_batches (id, supplier_id, started_at, status)
    VALUES (v_batch_id, p_supplier_id, v_started, 'processing');
    v_batch_open := true;

    FOR v_parent IN
        SELECT DISTINCT raw_data->>v_parent_key_source AS pkey
          FROM supplier_products_raw
         WHERE supplier_id = p_supplier_id
           AND status = 'pending'
           AND NULLIF(raw_data->>v_parent_key_source, '') IS NOT NULL
         LIMIT p_batch_size
    LOOP
      BEGIN
        -- 1) Produto: achar ou criar
        SELECT id INTO v_product_id
          FROM products
         WHERE supplier_id = p_supplier_id AND supplier_reference = v_parent.pkey;

        IF v_product_id IS NULL THEN
            INSERT INTO products (organization_id, supplier_id, supplier_reference, sku, name,
                                  active, is_active, sync_status, created_at, updated_at)
            VALUES (v_org_id, p_supplier_id, v_parent.pkey,
                    COALESCE(v_sku_prefix, '') || v_parent.pkey,
                    'Produto ' || v_parent.pkey, true, true, 'processing', now(), now())
            RETURNING id INTO v_product_id;
        END IF;

        SELECT COALESCE(locked_fields, '{}'::text[]) INTO v_locked
          FROM products WHERE id = v_product_id;

        -- Linha mais recente do pai para campos de produto
        SELECT raw_data INTO v_prep
          FROM supplier_products_raw
         WHERE supplier_id = p_supplier_id
           AND status = 'pending'
           AND raw_data->>v_parent_key_source = v_parent.pkey
         ORDER BY imported_at DESC NULLS LAST LIMIT 1;

        -- 2) Atualizar campos de produto (respeitando locked_fields)
        v_parts := ARRAY[]::text[];
        FOR v_map IN
            SELECT * FROM supplier_field_mappings
             WHERE supplier_id = p_supplier_id AND target_table = 'products' AND is_active = true
             ORDER BY priority
        LOOP
            CONTINUE WHEN v_map.target_field = ANY(v_locked);
            v_val := CASE WHEN v_map.source_path IS NOT NULL
                          THEN v_prep #>> string_to_array(v_map.source_path, '.')
                          ELSE v_prep ->> v_map.source_field END;
            CONTINUE WHEN v_val IS NULL OR btrim(v_val) = '';
            v_tv := fn_apply_transform(v_val, v_map.transform_type, v_map.transform_config,
                                       v_map.source_unit, v_map.target_unit, p_supplier_id);
            IF v_tv IS NOT NULL THEN
                v_parts := array_append(v_parts, format('%I = %L', v_map.target_field, v_tv));
            END IF;
        END LOOP;

        IF array_length(v_parts, 1) > 0 THEN
            EXECUTE format(
              'UPDATE products SET %s, updated_at=now(), sync_status=''synced'', last_sync_at=now(), last_sync_supplier_id=%L WHERE id=%L',
              array_to_string(v_parts, ', '), p_supplier_id, v_product_id);
        END IF;

        UPDATE products
           SET dimensions_display = fn_format_dimensions_display(length_cm, width_cm, height_cm)
         WHERE id = v_product_id AND length_cm IS NOT NULL
           AND NOT ('dimensions_display' = ANY(v_locked));

        -- 3) Variantes — FOR UPDATE SKIP LOCKED
        FOR v_row IN
            SELECT * FROM supplier_products_raw
             WHERE supplier_id = p_supplier_id
               AND status = 'pending'
               AND raw_data->>v_parent_key_source = v_parent.pkey
             FOR UPDATE SKIP LOCKED
        LOOP
          BEGIN
            -- Marcar como processing
            UPDATE supplier_products_raw SET status = 'processing' WHERE id = v_row.id;

            v_vfields := '{}'::jsonb;
            FOR v_map IN
                SELECT * FROM supplier_field_mappings
                 WHERE supplier_id = p_supplier_id AND target_table = 'product_variants' AND is_active = true
                 ORDER BY priority
            LOOP
                v_val := CASE WHEN v_map.source_path IS NOT NULL
                              THEN v_row.raw_data #>> string_to_array(v_map.source_path, '.')
                              ELSE v_row.raw_data ->> v_map.source_field END;
                CONTINUE WHEN v_val IS NULL OR btrim(v_val) = '';
                v_tv := fn_apply_transform(v_val, v_map.transform_type, v_map.transform_config,
                                           v_map.source_unit, v_map.target_unit, p_supplier_id);
                IF v_tv IS NOT NULL THEN
                    v_vfields := v_vfields || jsonb_build_object(v_map.target_field, v_tv);
                END IF;
            END LOOP;

            v_name := replace(v_name_template, '{product_name}',
                              COALESCE((SELECT name FROM products WHERE id = v_product_id), ''));
            v_name := replace(v_name, '{color_name}', COALESCE(v_vfields->>'color_name', ''));
            v_name := btrim(regexp_replace(v_name, '\s*[|-]\s*$', ''));
            v_attrs := jsonb_build_object(
                'codigo_cor', COALESCE(v_vfields->>'color_code', ''),
                'cor',        COALESCE(v_vfields->>'color_name', '')
            );

            v_sup_sku := NULLIF(v_row.supplier_sku, '');
            v_variant_id := NULL;
            IF v_sup_sku IS NOT NULL THEN
                SELECT id INTO v_variant_id FROM product_variants
                 WHERE product_id = v_product_id AND supplier_sku = v_sup_sku;
            END IF;

            IF v_variant_id IS NULL THEN
                v_sku := COALESCE(v_vfields->>'sku', v_sup_sku, v_row.supplier_reference);
                INSERT INTO product_variants (product_id, sku, supplier_sku, name,
                                              color_code, color_name, color_hex, attributes, is_active, created_at, updated_at)
                VALUES (v_product_id, v_sku, v_sup_sku, v_name,
                        v_vfields->>'color_code', v_vfields->>'color_name', v_vfields->>'color_hex',
                        v_attrs, true, now(), now())
                ON CONFLICT (sku) DO UPDATE SET
                    supplier_sku = EXCLUDED.supplier_sku, name = EXCLUDED.name, color_code = EXCLUDED.color_code,
                    color_name = EXCLUDED.color_name, color_hex = EXCLUDED.color_hex, attributes = EXCLUDED.attributes,
                    updated_at = now()
                RETURNING id INTO v_variant_id;
            ELSE
                UPDATE product_variants SET
                    name = v_name, color_code = v_vfields->>'color_code', color_name = v_vfields->>'color_name',
                    color_hex = v_vfields->>'color_hex', attributes = v_attrs, updated_at = now()
                WHERE id = v_variant_id;
            END IF;

            -- Campos extras de variante
            v_parts := ARRAY[]::text[];
            FOR v_k, v_v IN
                SELECT key, value FROM jsonb_each_text(
                    v_vfields - 'sku' - 'supplier_sku' - 'color_code' - 'color_name' - 'color_hex')
            LOOP
                v_parts := array_append(v_parts, format('%I = %L', v_k, v_v));
            END LOOP;
            IF array_length(v_parts, 1) > 0 THEN
                EXECUTE format('UPDATE product_variants SET %s, updated_at=now() WHERE id=%L',
                               array_to_string(v_parts, ', '), v_variant_id);
            END IF;

            -- variant_supplier_sources
            v_ssfields := '{}'::jsonb;
            FOR v_map IN
                SELECT * FROM supplier_field_mappings
                 WHERE supplier_id = p_supplier_id AND target_table = 'variant_supplier_sources' AND is_active = true
                 ORDER BY priority
            LOOP
                v_val := CASE WHEN v_map.source_path IS NOT NULL
                              THEN v_row.raw_data #>> string_to_array(v_map.source_path, '.')
                              ELSE v_row.raw_data ->> v_map.source_field END;
                CONTINUE WHEN v_val IS NULL OR btrim(v_val) = '';
                v_tv := fn_apply_transform(v_val, v_map.transform_type, v_map.transform_config,
                                           v_map.source_unit, v_map.target_unit, p_supplier_id);
                IF v_tv IS NOT NULL THEN
                    v_ssfields := v_ssfields || jsonb_build_object(v_map.target_field, v_tv);
                END IF;
            END LOOP;

            IF v_ssfields <> '{}'::jsonb THEN
                SELECT id INTO v_vss_id FROM variant_supplier_sources
                 WHERE variant_id = v_variant_id AND supplier_id = p_supplier_id;
                IF v_vss_id IS NULL THEN
                    INSERT INTO variant_supplier_sources (organization_id, variant_id, supplier_id, supplier_sku,
                                                          cost_price, quantity, source, is_preferred, is_active, updated_at)
                    VALUES (v_org_id, v_variant_id, p_supplier_id, v_sup_sku,
                            NULLIF(v_ssfields->>'cost_price', '')::numeric,
                            COALESCE(NULLIF(v_ssfields->>'quantity', '')::integer, 0),
                            'raw_v2', true, true, now());
                ELSE
                    UPDATE variant_supplier_sources SET
                        cost_price = COALESCE(NULLIF(v_ssfields->>'cost_price', '')::numeric, cost_price),
                        quantity   = COALESCE(NULLIF(v_ssfields->>'quantity', '')::integer, quantity),
                        source     = 'raw_v2',
                        updated_at = now()
                    WHERE id = v_vss_id;
                END IF;
            END IF;

            -- Sucesso: marcar como processed
            UPDATE supplier_products_raw
               SET status = 'processed', processed_at = now(),
                   product_id = v_product_id, variant_id = v_variant_id,
                   import_batch_id = v_batch_id,
                   process_errors = NULL, last_error = NULL, attempts = COALESCE(attempts, 0) + 1
             WHERE id = v_row.id;
            v_variants := v_variants + 1;

          EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors || jsonb_build_object('raw_id', v_row.id, 'stage', 'variant', 'error', SQLERRM);
            v_verr := v_verr + 1;
            UPDATE supplier_products_raw
               SET status = 'failed',
                   process_errors = jsonb_build_object('error', SQLERRM, 'stage', 'variant', 'timestamp', now()),
                   last_error = jsonb_build_object('error', SQLERRM, 'at', now()),
                   attempts = COALESCE(attempts, 0) + 1
             WHERE id = v_row.id;
          END;
        END LOOP;

        v_parents := v_parents + 1;
      EXCEPTION WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_object('parent_key', v_parent.pkey, 'stage', 'parent', 'error', SQLERRM);
        v_perr := v_perr + 1;
        UPDATE supplier_products_raw
           SET status = 'failed',
               process_errors = jsonb_build_object('error', SQLERRM, 'stage', 'parent', 'timestamp', now()),
               last_error = jsonb_build_object('error', SQLERRM, 'at', now()),
               attempts = COALESCE(attempts, 0) + 1
         WHERE supplier_id = p_supplier_id
           AND status IN ('pending', 'processing')
           AND raw_data->>v_parent_key_source = v_parent.pkey;
      END;
    END LOOP;

    -- Finaliza batch
    IF v_batch_open THEN
        UPDATE supplier_import_batches
           SET finished_at = now(), status = 'completed',
               products_imported = v_parents, variants_imported = v_variants,
               products_errors = v_perr, variants_errors = v_verr, error_log = v_errors
         WHERE id = v_batch_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 'supplier_id', p_supplier_id, 'bulk_mode', p_bulk_mode,
        'batch_id', v_batch_id,
        'parents_processed', v_parents, 'variants_processed', v_variants,
        'products_errors', v_perr, 'variants_errors', v_verr, 'errors', v_errors);
END;
$function$;

COMMENT ON FUNCTION public.fn_process_raw_v2(uuid, integer, boolean) IS
'Pipeline raw→products v2.2 — usa status enum (pending/processing/processed/failed) em vez de bool processed. FOR UPDATE SKIP LOCKED. Anti-zumbi. Popula attempts/last_error.';
