
-- Fix process_supplier_products_batch para usar status enum
CREATE OR REPLACE FUNCTION public.process_supplier_products_batch(
    p_supplier_id uuid,
    p_limit integer DEFAULT 100
)
RETURNS TABLE(
    staging_id uuid,
    supplier_reference text,
    success boolean,
    product_id uuid,
    variants_created integer,
    error_message text,
    processed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_raw RECORD;
    v_result JSONB;
BEGIN
    FOR v_raw IN 
        SELECT *
        FROM supplier_products_raw 
        WHERE supplier_id = p_supplier_id 
        AND status = 'pending'
        ORDER BY imported_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            -- Marcar como processing
            UPDATE supplier_products_raw SET status = 'processing' WHERE id = v_raw.id;

            v_result := process_supplier_product(
                v_raw.supplier_id,
                v_raw.raw_data,
                v_raw.supplier_reference
            );
            
            IF (v_result->>'success')::BOOLEAN THEN
                UPDATE supplier_products_raw 
                SET 
                    status = 'processed',
                    processed_at = NOW(),
                    product_id = (v_result->>'product_id')::UUID,
                    process_errors = NULL,
                    updated_at = NOW()
                WHERE id = v_raw.id;
                
                staging_id := v_raw.id;
                supplier_reference := v_raw.supplier_reference;
                success := TRUE;
                product_id := (v_result->>'product_id')::UUID;
                variants_created := (v_result->>'variants_created')::INTEGER;
                error_message := NULL;
                processed_at := NOW();
                RETURN NEXT;
            ELSE
                UPDATE supplier_products_raw 
                SET 
                    status = 'failed',
                    process_errors = v_result->'errors',
                    updated_at = NOW()
                WHERE id = v_raw.id;
                
                staging_id := v_raw.id;
                supplier_reference := v_raw.supplier_reference;
                success := FALSE;
                product_id := NULL;
                variants_created := 0;
                error_message := (v_result->'errors'->>0);
                processed_at := NOW();
                RETURN NEXT;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            UPDATE supplier_products_raw 
            SET 
                status = 'failed',
                process_errors = jsonb_build_object(
                    'fatal_error', SQLERRM,
                    'timestamp', NOW()
                ),
                updated_at = NOW()
            WHERE id = v_raw.id;
            
            staging_id := v_raw.id;
            supplier_reference := v_raw.supplier_reference;
            success := FALSE;
            product_id := NULL;
            variants_created := 0;
            error_message := SQLERRM;
            processed_at := NOW();
            RETURN NEXT;
        END;
    END LOOP;
    
    RETURN;
END;
$function$;

COMMENT ON FUNCTION public.process_supplier_products_batch(uuid, integer) IS
'Wrapper batch legado — atualizado para usar status enum (pending/processed/failed) em vez de bool processed.';
