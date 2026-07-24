-- =============================================================================
-- FIX: 3 funções SECURITY INVOKER que acessam schema archive → SECURITY DEFINER
-- =============================================================================
-- PADRÃO: authenticated não tem USAGE no schema archive.
-- Funções SECURITY INVOKER que acessam archive falham com permission denied.
-- FIX: SECURITY DEFINER + SET search_path = public, archive.
-- =============================================================================

-- 1. registrar_entrada_estoque (escreve em archive.stock_movements)
CREATE OR REPLACE FUNCTION public.registrar_entrada_estoque(
  p_variant_sku character varying,
  p_quantity integer,
  p_unit_cost numeric DEFAULT NULL,
  p_supplier_name character varying DEFAULT NULL,
  p_document_number character varying DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, archive
AS $function$
DECLARE
    v_variant_id UUID;
    v_stock_before INTEGER;
    v_stock_after INTEGER;
    v_movement_id UUID;
BEGIN
    IF p_quantity <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Quantidade deve ser maior que zero');
    END IF;
    SELECT id INTO v_variant_id FROM product_variants WHERE sku = p_variant_sku;
    IF v_variant_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', format('Variante não encontrada: %s', p_variant_sku));
    END IF;
    SELECT COALESCE(stock_quantity, 0) INTO v_stock_before FROM product_variants WHERE id = v_variant_id;
    v_stock_after := v_stock_before + p_quantity;
    INSERT INTO archive.stock_movements (id, variant_id, movement_type, quantity, stock_before, stock_after, unit_cost, reference_type, reference_number, notes, created_by, created_at)
    VALUES (gen_random_uuid(), v_variant_id, 'ENTRADA', p_quantity, v_stock_before, v_stock_after, p_unit_cost,
            CASE WHEN p_document_number IS NOT NULL THEN 'NF' ELSE NULL END, p_document_number,
            COALESCE(p_notes, format('Entrada de %s unidades - Fornecedor: %s', p_quantity, COALESCE(p_supplier_name, 'N/A'))),
            p_user_id, NOW())
    RETURNING id INTO v_movement_id;
    UPDATE product_variants SET stock_quantity = v_stock_after, updated_at = NOW() WHERE id = v_variant_id;
    RETURN json_build_object('success', true, 'movement_id', v_movement_id, 'variant_id', v_variant_id, 'sku', p_variant_sku,
                             'quantity_added', p_quantity, 'stock_before', v_stock_before, 'stock_after', v_stock_after, 'movement_type', 'ENTRADA');
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- 2. registrar_saida_estoque (escreve em archive.stock_movements)
CREATE OR REPLACE FUNCTION public.registrar_saida_estoque(
  p_variant_sku character varying,
  p_quantity integer,
  p_movement_type character varying DEFAULT 'VENDA',
  p_document_number character varying DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_allow_negative boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, archive
AS $function$
DECLARE
    v_variant_id UUID;
    v_stock_before INTEGER;
    v_stock_after INTEGER;
    v_movement_id UUID;
BEGIN
    IF p_quantity <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Quantidade deve ser maior que zero');
    END IF;
    IF p_movement_type NOT IN ('VENDA', 'RESERVA', 'AJUSTE', 'PERDA', 'DEVOLUCAO_FORNECEDOR') THEN
        RETURN json_build_object('success', false, 'error', format('Tipo de movimento inválido: %s', p_movement_type));
    END IF;
    SELECT id INTO v_variant_id FROM product_variants WHERE sku = p_variant_sku;
    IF v_variant_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', format('Variante não encontrada: %s', p_variant_sku));
    END IF;
    SELECT COALESCE(stock_quantity, 0) INTO v_stock_before FROM product_variants WHERE id = v_variant_id;
    IF v_stock_before < p_quantity AND NOT p_allow_negative THEN
        RETURN json_build_object('success', false, 'error', 'Estoque insuficiente', 'stock_available', v_stock_before, 'quantity_requested', p_quantity);
    END IF;
    v_stock_after := v_stock_before - p_quantity;
    INSERT INTO archive.stock_movements (id, variant_id, movement_type, quantity, stock_before, stock_after, reference_type, reference_number, notes, created_by, created_at)
    VALUES (gen_random_uuid(), v_variant_id, 'SAIDA', -p_quantity, v_stock_before, v_stock_after, p_movement_type, p_document_number,
            COALESCE(p_notes, format('Saída de %s unidades - Tipo: %s', p_quantity, p_movement_type)), p_user_id, NOW())
    RETURNING id INTO v_movement_id;
    UPDATE product_variants SET stock_quantity = v_stock_after, updated_at = NOW() WHERE id = v_variant_id;
    RETURN json_build_object('success', true, 'movement_id', v_movement_id, 'variant_id', v_variant_id, 'sku', p_variant_sku,
                             'quantity_removed', p_quantity, 'stock_before', v_stock_before, 'stock_after', v_stock_after, 'movement_type', p_movement_type);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- 3. restore_collection_item_from_trash (escreve em archive.collection_items)
CREATE OR REPLACE FUNCTION public.restore_collection_item_from_trash(_item_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, archive
AS $function$
DECLARE v_row record;
BEGIN
  SELECT * INTO v_row FROM public.collection_items_trash WHERE id = _item_id AND user_id = auth.uid();
  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO archive.collection_items (id, collection_id, product_id, color_name, color_hex, thumbnail_url, notes, price_at_save, sort_order)
  VALUES (
    COALESCE(v_row.original_id, gen_random_uuid()),
    v_row.collection_id,
    v_row.product_id,
    v_row.color_name,
    v_row.color_hex,
    v_row.thumbnail_url,
    v_row.notes,
    v_row.price_at_save,
    v_row.sort_order
  );

  DELETE FROM public.collection_items_trash WHERE id = _item_id;
  RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $function$;

NOTIFY pgrst, 'reload schema';
