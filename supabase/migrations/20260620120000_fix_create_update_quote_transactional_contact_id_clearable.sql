-- Migration: fix_create_update_quote_transactional_contact_id_clearable
-- Data: 2026-06-20
-- Supersedes: 20260619110000 (applied only fn_create_quote_v3 — wrong function for BUG-D)
--
-- DESCOBERTA CRÍTICA:
--   quoteService.createQuote() chama create_quote_transactional(_quote, _items)
--   quoteService.updateQuote() chama update_quote_transactional(_quote_id, _quote_patch, _items)
--   A migration 20260619110000 corrigiu fn_create_quote_v3 (não usada pelo frontend)
--   e update_quote_transactional — mas a migration nunca foi aplicada em produção
--   devido a gap de timestamp (ficou atrás de migrations já aplicadas).
--
-- BUGS CORRIGIDOS NESTA MIGRATION:
--
-- BUG-D (CRÍTICO — create_quote_transactional):
--   contact_id estava completamente ausente do INSERT de quotes.
--   buildInsertPayload envia contact_id mas a coluna nunca era gravada.
--   → Toda criação de orçamento perdia silenciosamente a associação CRM.
--
-- BUG-A (CRÍTICO — update_quote_transactional):
--   contact_id estava completamente ausente do UPDATE de quotes.
--   buildUpdatePayload envia contact_id mas a coluna nunca era atualizada.
--   → Toda edição de orçamento descartava silenciosamente a associação CRM.
--
-- BUG-C (ALTO — update_quote_transactional):
--   notes, internal_notes e valid_until usavam COALESCE(_patch->>'field', existing).
--   buildUpdatePayload envia null para campos esvaziados; COALESCE(null, existing)
--   preserva o valor antigo — impossível limpar esses campos uma vez preenchidos.
--   Fix: CASE WHEN _quote_patch ? 'field' THEN value ELSE existing END.
--   O operador ? verifica presença da chave no JSONB (não o valor).

-- ════════════════════════════════════════════════════════════════════════════════
-- 1. Corrige create_quote_transactional: adiciona contact_id no INSERT
-- ════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_quote_transactional(_quote jsonb, _items jsonb)
RETURNS quotes
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _new_quote    public.quotes;
  _new_quote_id uuid;
  _item         jsonb;
  _pers         jsonb;
  _new_item_id  uuid;
  _actor_id     uuid;
BEGIN
  -- ── 1. Cria o orçamento (quote_number preenchido pelo trigger generate_quote_number) ──
  INSERT INTO public.quotes (
    quote_number, client_id, contact_id, client_name, client_email, client_phone, client_company,
    seller_id, organization_id, status,
    subtotal, discount_percent, discount_amount, total, negotiation_markup_percent,
    payment_method, payment_terms, delivery_time, shipping_type, shipping_cost,
    notes, internal_notes, valid_until
  )
  VALUES (
    coalesce(_quote->>'quote_number', ''),
    nullif(_quote->>'client_id', '')::uuid,
    nullif(_quote->>'contact_id', '')::uuid,
    coalesce(_quote->>'client_name', ''),
    _quote->>'client_email',
    _quote->>'client_phone',
    _quote->>'client_company',
    nullif(_quote->>'seller_id', '')::uuid,
    nullif(_quote->>'organization_id', '')::uuid,
    coalesce(_quote->>'status', 'draft'),
    coalesce((_quote->>'subtotal')::numeric, 0),
    coalesce((_quote->>'discount_percent')::numeric, 0),
    coalesce((_quote->>'discount_amount')::numeric, 0),
    coalesce((_quote->>'total')::numeric, 0),
    coalesce((_quote->>'negotiation_markup_percent')::numeric, 0),
    _quote->>'payment_method',
    _quote->>'payment_terms',
    _quote->>'delivery_time',
    _quote->>'shipping_type',
    coalesce((_quote->>'shipping_cost')::numeric, 0),
    _quote->>'notes',
    _quote->>'internal_notes',
    nullif(_quote->>'valid_until', '')::date
  )
  RETURNING * INTO _new_quote;

  _new_quote_id := _new_quote.id;

  -- ── 2. Insere itens ─────────────────────────────────────────────────────────
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
      _new_quote_id,
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

    -- ── 3. Insere personalizações do item ──────────────────────────────────────
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

  -- ── 4. Relê a linha final (quote_number + totais recalculados pelos triggers) ──
  SELECT * INTO _new_quote FROM public.quotes WHERE id = _new_quote_id;

  -- ── 5. Audit trail ────────────────────────────────────────────────────────────
  _actor_id := coalesce(auth.uid(), nullif(_quote->>'seller_id', '')::uuid);
  IF _actor_id IS NOT NULL THEN
    INSERT INTO public.quote_history (quote_id, user_id, action, description, metadata)
    VALUES (
      _new_quote_id,
      _actor_id,
      'created',
      format('Orçamento %s criado com %s item(s) via RPC',
             _new_quote.quote_number,
             (SELECT count(*) FROM public.quote_items WHERE quote_id = _new_quote_id)),
      jsonb_build_object(
        'status',    _new_quote.status,
        'subtotal',  _new_quote.subtotal,
        'total',     _new_quote.total,
        'markup',    _new_quote.negotiation_markup_percent,
        'n_items',   (SELECT count(*) FROM public.quote_items WHERE quote_id = _new_quote_id)
      )
    );
  END IF;

  RETURN _new_quote;
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════════
-- 2. Corrige update_quote_transactional: adiciona contact_id + fix clearable fields
-- ════════════════════════════════════════════════════════════════════════════════
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
  -- ── 0. Captura estado anterior (para diff do audit trail e validação de versão) ──
  SELECT version, status, total
  INTO _current_version, _prev_status, _prev_total
  FROM public.quotes WHERE id = _quote_id;

  -- ── Optimistic locking ────────────────────────────────────────────────────────
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

  -- ── 1. Atualiza o orçamento ─────────────────────────────────────────────────
  UPDATE public.quotes
  SET
    client_id                  = coalesce(nullif(_quote_patch->>'client_id', ''), client_id::text)::uuid,
    -- BUG-A FIX: contact_id com ? para permitir limpeza (CASE em vez de COALESCE)
    contact_id                 = CASE WHEN _quote_patch ? 'contact_id'
                                      THEN nullif(_quote_patch->>'contact_id', '')::uuid
                                      ELSE contact_id END,
    client_name                = coalesce(nullif(_quote_patch->>'client_name', ''), client_name),
    client_email               = coalesce(_quote_patch->>'client_email',     client_email),
    client_phone               = coalesce(_quote_patch->>'client_phone',     client_phone),
    client_company             = coalesce(_quote_patch->>'client_company',   client_company),
    status                     = coalesce(_quote_patch->>'status',           status),
    shipping_type              = coalesce(_quote_patch->>'shipping_type',    shipping_type),
    shipping_cost              = coalesce((_quote_patch->>'shipping_cost')::numeric,            shipping_cost),
    payment_method             = coalesce(_quote_patch->>'payment_method',   payment_method),
    payment_terms              = coalesce(_quote_patch->>'payment_terms',    payment_terms),
    delivery_time              = coalesce(_quote_patch->>'delivery_time',    delivery_time),
    -- BUG-C FIX: campos anuláveis usam ? para detectar presença da chave no JSONB
    notes                      = CASE WHEN _quote_patch ? 'notes'
                                      THEN _quote_patch->>'notes'
                                      ELSE notes END,
    internal_notes             = CASE WHEN _quote_patch ? 'internal_notes'
                                      THEN _quote_patch->>'internal_notes'
                                      ELSE internal_notes END,
    discount_percent           = coalesce((_quote_patch->>'discount_percent')::numeric,         discount_percent),
    discount_amount            = coalesce((_quote_patch->>'discount_amount')::numeric,          discount_amount),
    subtotal                   = coalesce((_quote_patch->>'subtotal')::numeric,                 subtotal),
    total                      = coalesce((_quote_patch->>'total')::numeric,                    total),
    negotiation_markup_percent = coalesce((_quote_patch->>'negotiation_markup_percent')::numeric, negotiation_markup_percent),
    -- BUG-C FIX: valid_until pode ser limpo para NULL via ? operator
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

  -- ── 2. Remove itens/personalizações existentes ───────────────────────────────
  DELETE FROM public.quote_item_personalizations
  WHERE quote_item_id IN (
    SELECT id FROM public.quote_items WHERE quote_id = _quote_id
  );
  DELETE FROM public.quote_items WHERE quote_id = _quote_id;

  -- ── 3. Reinsere itens ─────────────────────────────────────────────────────────
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

    -- ── 4. Reinsere personalizações ───────────────────────────────────────────
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

  -- ── 5. Audit trail ────────────────────────────────────────────────────────────
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
