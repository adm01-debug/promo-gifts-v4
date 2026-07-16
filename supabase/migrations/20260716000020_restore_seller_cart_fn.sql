-- Migration: ensure public.restore_seller_cart(jsonb) exists in canonical DB
--
-- Background:
--   Migration 20260713101342_restore_seller_cart.sql was intended for the
--   canonical project (doufsxqlfjyuvxuezpln) but was applied inconsistently.
--   This migration pins the authoritative definition so the function is
--   guaranteed present regardless of prior migration history.
--
-- Return type: jsonb (PostgREST returns the JSON object directly; clients
--   destructure cart_id / items_total / items_inserted / items_deduped).
--
-- Contract (enforced by tests/security/restore-seller-cart-rpc.test.ts):
--   22023 (invalid_parameter_value) → invalid_snapshot
--   28000 (invalid_authorization)   → not_authenticated
--   42501 (insufficient_privilege)  → seller_mismatch
--
-- NOTE: Requires DROP + CREATE because PostgreSQL does not allow changing
-- the return type via CREATE OR REPLACE.

DROP FUNCTION IF EXISTS public.restore_seller_cart(jsonb);

CREATE FUNCTION public.restore_seller_cart(_snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid                uuid := auth.uid();
  _snapshot_seller_id uuid;
  _new_cart_id        uuid;
  _items_input        jsonb;
  _items_deduped      jsonb;
  _items_inserted     int := 0;
  _items_total        int := 0;
BEGIN
  -- Guard: usuário precisa estar autenticado
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- Guard: snapshot precisa ser objeto JSON válido
  IF _snapshot IS NULL OR jsonb_typeof(_snapshot) <> 'object' THEN
    RAISE EXCEPTION 'invalid_snapshot' USING ERRCODE = '22023';
  END IF;

  -- Guard: o seller_id do snapshot (se presente) deve bater com o usuário
  _snapshot_seller_id := NULLIF(_snapshot->>'seller_id', '')::uuid;
  IF _snapshot_seller_id IS NOT NULL AND _snapshot_seller_id <> _uid THEN
    RAISE EXCEPTION 'seller_mismatch' USING ERRCODE = '42501';
  END IF;

  -- 1) INSERT do carrinho (allowlist estrita — nunca vaza id/timestamps do snapshot)
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

  -- 2) Dedup de itens por (product_id, color_name), somando quantities (cap 999999)
  _items_input := COALESCE(_snapshot->'items', '[]'::jsonb);
  IF jsonb_typeof(_items_input) <> 'array' THEN
    _items_input := '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(dedup)::jsonb), '[]'::jsonb),
         COUNT(*)::int
    INTO _items_deduped, _items_total
  FROM (
    SELECT
      it->>'product_id'                                                           AS product_id,
      MAX(it->>'product_name')                                                    AS product_name,
      MAX(it->>'product_sku')                                                     AS product_sku,
      MAX(it->>'product_image_url')                                               AS product_image_url,
      MAX(COALESCE((it->>'product_price')::numeric, 0))                           AS product_price,
      LEAST(999999, SUM(GREATEST(1, COALESCE((it->>'quantity')::int, 1))))::int   AS quantity,
      NULLIF(it->>'color_name', '')                                               AS color_name,
      MAX(NULLIF(it->>'color_hex', ''))                                           AS color_hex,
      MAX(NULLIF(it->>'notes', ''))                                               AS notes,
      MIN(NULLIF(it->>'sort_order', '')::int)                                     AS sort_order
    FROM jsonb_array_elements(_items_input) AS it
    WHERE COALESCE(it->>'product_id', '') <> ''
    GROUP BY it->>'product_id', NULLIF(it->>'color_name', '')
  ) dedup;

  -- 3) INSERT em massa com ON CONFLICT DO NOTHING (race condition defense)
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

-- Grants: only authenticated callers; anon must not reach this function
REVOKE ALL ON FUNCTION public.restore_seller_cart(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_seller_cart(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_seller_cart(jsonb) TO service_role;
