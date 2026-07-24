-- =============================================================================
-- RESTORE SELLER CART — restauração atômica de carrinho excluído (Undo)
-- =============================================================================
-- Motivação: a restauração no client fazia 2 INSERTs sequenciais (cart, depois
-- items em lote). Se o segundo falhasse (unique, RLS, coluna), sobrava um
-- carrinho órfão sem itens. Além disso, snapshots com dois itens iguais
-- (mesmo product_id + color_name null) quebravam o lote via
-- `unique_cart_item_variant NULLS NOT DISTINCT`. Esta função resolve os dois
-- problemas em uma única transação.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.restore_seller_cart(_snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _snapshot_seller_id uuid;
  _new_cart_id uuid;
  _items_input jsonb;
  _items_deduped jsonb;
  _items_inserted int := 0;
  _items_total int := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF _snapshot IS NULL OR jsonb_typeof(_snapshot) <> 'object' THEN
    RAISE EXCEPTION 'invalid_snapshot' USING ERRCODE = '22023';
  END IF;

  _snapshot_seller_id := NULLIF(_snapshot->>'seller_id', '')::uuid;
  IF _snapshot_seller_id IS NOT NULL AND _snapshot_seller_id <> _uid THEN
    RAISE EXCEPTION 'seller_mismatch' USING ERRCODE = '42501';
  END IF;

  -- 1) INSERT do carrinho (allowlist estrita; nunca vaza id/seller_id/timestamps
  -- do snapshot original — todos default no BD).
  INSERT INTO public.seller_carts (
    seller_id,
    company_id,
    company_name,
    company_location,
    company_logo_url,
    notes,
    status,
    shipping_deadline
  )
  VALUES (
    _uid,
    _snapshot->>'company_id',
    _snapshot->>'company_name',
    NULLIF(_snapshot->>'company_location', ''),
    NULLIF(_snapshot->>'company_logo_url', ''),
    NULLIF(_snapshot->>'notes', ''),
    COALESCE(NULLIF(_snapshot->>'status', ''), 'em_separacao'),
    NULLIF(_snapshot->>'shipping_deadline', '')::date
  )
  RETURNING id INTO _new_cart_id;

  -- 2) Dedup de itens no próprio snapshot: agrupa por (product_id, color_name)
  -- somando quantities (cap em 999999 p/ respeitar CHECK do BD).
  _items_input := COALESCE(_snapshot->'items', '[]'::jsonb);
  IF jsonb_typeof(_items_input) <> 'array' THEN
    _items_input := '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(dedup)::jsonb), '[]'::jsonb),
         COUNT(*)::int
    INTO _items_deduped, _items_total
  FROM (
    SELECT
      it->>'product_id'                                  AS product_id,
      MAX(it->>'product_name')                           AS product_name,
      MAX(it->>'product_sku')                            AS product_sku,
      MAX(it->>'product_image_url')                      AS product_image_url,
      MAX((it->>'product_price')::numeric)               AS product_price,
      LEAST(999999, SUM(GREATEST(1, COALESCE((it->>'quantity')::int, 1))))::int AS quantity,
      NULLIF(it->>'color_name', '')                      AS color_name,
      MAX(NULLIF(it->>'color_hex', ''))                  AS color_hex,
      MAX(NULLIF(it->>'notes', ''))                      AS notes,
      MIN(NULLIF(it->>'sort_order', '')::int)            AS sort_order
    FROM jsonb_array_elements(_items_input) AS it
    WHERE COALESCE(it->>'product_id', '') <> ''
    GROUP BY it->>'product_id', NULLIF(it->>'color_name', '')
  ) dedup;

  -- 3) INSERT em massa com ON CONFLICT DO NOTHING (defesa contra corrida
  -- entre restore + insert manual concorrente).
  IF jsonb_array_length(_items_deduped) > 0 THEN
    INSERT INTO public.seller_cart_items (
      cart_id, product_id, product_name, product_sku, product_image_url,
      product_price, quantity, color_name, color_hex, notes, sort_order
    )
    SELECT
      _new_cart_id,
      row_data->>'product_id',
      row_data->>'product_name',
      row_data->>'product_sku',
      row_data->>'product_image_url',
      COALESCE((row_data->>'product_price')::numeric, 0),
      COALESCE((row_data->>'quantity')::int, 1),
      row_data->>'color_name',
      row_data->>'color_hex',
      row_data->>'notes',
      NULLIF(row_data->>'sort_order', '')::int
    FROM jsonb_array_elements(_items_deduped) AS row_data
    ON CONFLICT ON CONSTRAINT unique_cart_item_variant DO NOTHING;

    GET DIAGNOSTICS _items_inserted = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'cart_id',        _new_cart_id,
    'items_total',    _items_total,
    'items_inserted', _items_inserted,
    'items_deduped',  GREATEST(0, jsonb_array_length(_items_input) - _items_total)
  );
END;
$$;

-- ACL: apenas usuários autenticados; RLS das tabelas continua ativa porque a
-- função é SECURITY DEFINER mas checa auth.uid() explicitamente e insere
-- sempre com seller_id = auth.uid(). Nunca conceder para anon/public.
REVOKE ALL ON FUNCTION public.restore_seller_cart(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_seller_cart(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.restore_seller_cart(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_seller_cart(jsonb) TO service_role;

COMMENT ON FUNCTION public.restore_seller_cart(jsonb) IS
'Restaura carrinho excluído (Undo) em transação atômica. Deduplica itens por (product_id, color_name) somando quantidades; ON CONFLICT DO NOTHING contra unique_cart_item_variant. Retorna jsonb {cart_id, items_total, items_inserted, items_deduped}.';