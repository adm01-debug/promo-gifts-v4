-- Migration: fix_update_quote_client_cnpj_clearable
-- Date: 2026-06-20
--
-- BUG: In update_quote_transactional (20260620140000), client_cnpj was added with:
--   client_cnpj = coalesce(_quote_patch->>'client_cnpj', client_cnpj)
--
-- buildUpdatePayload sends client_cnpj: quote.client_cnpj || null.
-- When the user changes to a client without a CNPJ, buildUpdatePayload sends
-- { ..., "client_cnpj": null }. COALESCE(null, old_cnpj) preserves the old value,
-- so the quote permanently retains the previous client's CNPJ.
--
-- Fix: use the same ? CASE WHEN pattern used for contact_id, notes, and valid_until.
-- The ? operator detects key presence in JSONB regardless of whether its value is null.

CREATE OR REPLACE FUNCTION public.update_quote_transactional(
  _quote_id        uuid,
  _quote_patch     jsonb,
  _items           jsonb,
  _expected_version integer DEFAULT NULL::integer
)
RETURNS quotes
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _updated_quote   public.quotes;
  _current_version integer;
  _prev_status     text;
  _prev_total      numeric;
  _item            jsonb;
  _pers            jsonb;
  _new_item_id     uuid;
  _actor_id        uuid;
  _action          text;
  _desc            text;
BEGIN
  SELECT version, status, total
  INTO _current_version, _prev_status, _prev_total
  FROM public.quotes WHERE id = _quote_id;

  IF _expected_version IS NOT NULL THEN
    IF _current_version IS NULL THEN
      RAISE EXCEPTION 'Orçamento não encontrado: %', _quote_id
        USING errcode = 'no_data_found';
    END IF;
    IF _current_version <> _expected_version THEN
      RAISE EXCEPTION
        'Conflito de versão: orçamento foi modificado por outro usuário (versão atual: %, versão esperada: %). Recarregue e tente novamente.',
        _current_version, _expected_version
        USING errcode = '40001';
    END IF;
  END IF;

  UPDATE public.quotes
  SET
    client_id                  = coalesce(nullif(_quote_patch->>'client_id', ''), client_id::text)::uuid,
    contact_id                 = CASE WHEN _quote_patch ? 'contact_id'
                                      THEN nullif(_quote_patch->>'contact_id', '')::uuid
                                      ELSE contact_id END,
    client_name                = coalesce(nullif(_quote_patch->>'client_name', ''), client_name),
    client_email               = coalesce(_quote_patch->>'client_email',   client_email),
    client_phone               = coalesce(_quote_patch->>'client_phone',   client_phone),
    client_company             = coalesce(_quote_patch->>'client_company', client_company),
    -- BUG-FIX: COALESCE cannot clear client_cnpj when patch contains null.
    -- Use ? CASE WHEN so that {"client_cnpj": null} clears the field.
    client_cnpj                = CASE WHEN _quote_patch ? 'client_cnpj'
                                      THEN nullif(_quote_patch->>'client_cnpj', '')
                                      ELSE client_cnpj END,
    status                     = coalesce(_quote_patch->>'status',           status),
    shipping_type              = coalesce(_quote_patch->>'shipping_type',    shipping_type),
    shipping_cost              = coalesce((_quote_patch->>'shipping_cost')::numeric,              shipping_cost),
    payment_method             = coalesce(_quote_patch->>'payment_method',   payment_method),
    payment_terms              = coalesce(_quote_patch->>'payment_terms',    payment_terms),
    delivery_time              = coalesce(_quote_patch->>'delivery_time',    delivery_time),
    notes                      = CASE WHEN _quote_patch ? 'notes'
                                      THEN _quote_patch->>'notes'
                                      ELSE notes END,
    internal_notes             = CASE WHEN _quote_patch ? 'internal_notes'
                                      THEN _quote_patch->>'internal_notes'
                                      ELSE internal_notes END,
    discount_percent           = coalesce((_quote_patch->>'discount_percent')::numeric,           discount_percent),
    discount_amount            = coalesce((_quote_patch->>'discount_amount')::numeric,            discount_amount),
    subtotal                   = coalesce((_quote_patch->>'subtotal')::numeric,                   subtotal),
    total                      = coalesce((_quote_patch->>'total')::numeric,                      total),
    negotiation_markup_percent = coalesce((_quote_patch->>'negotiation_markup_percent')::numeric, negotiation_markup_percent),
    valid_until                = CASE WHEN _quote_patch ? 'valid_until'
                                      THEN nullif(_quote_patch->>'valid_until', '')::date
                                      ELSE valid_until END,
    updated_at                 = now()
  WHERE id = _quote_id
  RETURNING * INTO _updated_quote;

  IF _updated_quote IS NULL THEN
    RAISE EXCEPTION 'Orçamento não encontrado: %', _quote_id
      USING errcode = 'no_data_found';
  END IF;

  DELETE FROM public.quote_item_personalizations
  WHERE quote_item_id IN (
    SELECT id FROM public.quote_items WHERE quote_id = _quote_id
  );
  DELETE FROM public.quote_items WHERE quote_id = _quote_id;

  FOR _item IN SELECT value FROM jsonb_array_elements(coalesce(_items, '[]'::jsonb)) LOOP
    INSERT INTO public.quote_items (
      quote_id, product_id, product_name, product_sku, product_image_url,
      quantity, unit_price, subtotal,
      discount_percentage, discount_amount,
      color_name, color_hex, size_code, gender,
      sort_order, notes, kit_group_id, kit_name,
      price_confirmed_at, price_updated_at, price_freshness_threshold_days, bitrix_product_id
    )
    VALUES (
      _quote_id,
      nullif(_item->>'product_id', '')::uuid,
      _item->>'product_name',
      _item->>'product_sku',
      _item->>'product_image_url',
      coalesce((_item->>'quantity')::integer, 0),
      coalesce((_item->>'unit_price')::numeric, 0),
      coalesce((_item->>'subtotal')::numeric, 0),
      coalesce((_item->>'discount_percentage')::numeric, 0),
      coalesce((_item->>'discount_amount')::numeric, 0),
      _item->>'color_name',
      _item->>'color_hex',
      nullif(_item->>'size_code', ''),
      nullif(_item->>'gender', ''),
      coalesce((_item->>'sort_order')::integer, 0),
      _item->>'notes',
      nullif(_item->>'kit_group_id', '')::uuid,
      nullif(_item->>'kit_name', ''),
      nullif(_item->>'price_confirmed_at', '')::timestamptz,
      nullif(_item->>'price_updated_at', '')::timestamptz,
      coalesce(nullif(_item->>'price_freshness_threshold_days', '')::integer, 60),
      nullif(_item->>'bitrix_product_id', '')
    )
    RETURNING id INTO _new_item_id;

    FOR _pers IN SELECT value FROM jsonb_array_elements(coalesce(_item->'personalizations', '[]'::jsonb)) LOOP
      INSERT INTO public.quote_item_personalizations (
        quote_item_id, technique_id, technique_name,
        location_code, location_name,
        personalized_quantity, colors_count, positions_count,
        area_cm2, width_cm, height_cm,
        setup_cost, unit_cost, total_cost, notes
      )
      VALUES (
        _new_item_id,
        nullif(_pers->>'technique_id', '')::uuid,
        _pers->>'technique_name',
        _pers->>'location_code',
        _pers->>'location_name',
        nullif(_pers->>'personalized_quantity', '')::integer,
        coalesce((_pers->>'colors_count')::integer, 1),
        coalesce((_pers->>'positions_count')::integer, 1),
        nullif(_pers->>'area_cm2', '')::numeric,
        nullif(_pers->>'width_cm', '')::numeric,
        nullif(_pers->>'height_cm', '')::numeric,
        coalesce((_pers->>'setup_cost')::numeric, 0),
        coalesce((_pers->>'unit_cost')::numeric, 0),
        coalesce((_pers->>'total_cost')::numeric, 0),
        _pers->>'notes'
      );
    END LOOP;
  END LOOP;

  _actor_id := coalesce(auth.uid(), _updated_quote.seller_id);
  IF _actor_id IS NOT NULL THEN
    IF _prev_status IS DISTINCT FROM _updated_quote.status THEN
      _action := 'status_changed';
      _desc   := format('Status alterado de "%s" para "%s" no %s',
                        _prev_status, _updated_quote.status, _updated_quote.quote_number);
    ELSE
      _action := 'updated';
      _desc   := format('Orçamento %s editado (total: R$ %s)',
                        _updated_quote.quote_number,
                        _updated_quote.total);
    END IF;

    INSERT INTO public.quote_history (quote_id, user_id, action, description, metadata)
    VALUES (
      _quote_id,
      _actor_id,
      _action,
      _desc,
      jsonb_build_object(
        'prev_status',          _prev_status,
        'new_status',           _updated_quote.status,
        'prev_total',           _prev_total,
        'new_total',            _updated_quote.total,
        'markup',               _updated_quote.negotiation_markup_percent,
        'n_items',              (SELECT count(*) FROM public.quote_items WHERE quote_id = _quote_id),
        'optimistic_lock_used', (_expected_version IS NOT NULL)
      )
    );
  END IF;

  RETURN _updated_quote;
END;
$function$;
