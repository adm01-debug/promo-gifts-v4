-- Migration: fix_rpc_bugs_contact_id_clearable_fields_item_columns
-- Data: 2026-06-19
--
-- Corrige quatro bugs críticos nos RPCs de orçamentos:
--
-- BUG-A (CRÍTICO — update_quote_transactional):
--   contact_id estava completamente ausente do UPDATE do quotes.
--   O buildUpdatePayload envia contact_id mas a coluna nunca era atualizada.
--   → Toda edição de orçamento descartava silenciosamente a associação CRM.
--
-- BUG-B (ALTO — update_quote_transactional):
--   O INSERT de quote_items não incluía: bitrix_product_id, price_confirmed_at,
--   price_freshness_threshold_days, price_updated_at.
--   A RPC deleta e re-insere todos os itens; esses 4 campos eram resetados
--   para NULL a cada salvamento.
--
-- BUG-C (ALTO — update_quote_transactional):
--   Campos nullable usavam COALESCE(_quote_patch->>'field', existing).
--   Como buildUpdatePayload envia null para campos vazios, COALESCE(null, existing)
--   preserva o valor antigo — impossível limpar notes, internal_notes, valid_until,
--   client_email, client_phone ou client_company uma vez preenchidos.
--   Fix: CASE WHEN _quote_patch ? 'field' THEN value ELSE existing END.
--   O operador ? verifica presença da chave no JSONB, não o valor.
--
-- BUG-D (ALTO — fn_create_quote_v3):
--   contact_id estava ausente do INSERT de quotes e de price_confirmed_at,
--   price_freshness_threshold_days, price_updated_at no INSERT de quote_items.
--   → Criação de orçamento via RPC perdia a associação CRM e metadados de preço.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. update_quote_transactional — versão corrigida completa
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.update_quote_transactional(
  _quote_id uuid,
  _quote_patch jsonb,
  _items jsonb
)
returns public.quotes
language plpgsql
security invoker
set search_path = public
as $$
declare
  _updated_quote public.quotes;
  _item          jsonb;
  _pers          jsonb;
  _new_item_id   uuid;
begin
  update public.quotes
  set
    client_id                  = coalesce(nullif(_quote_patch->>'client_id','')::uuid, client_id),
    -- BUG-A FIX: contact_id nunca era atualizado; usa ? para que JSON null limpe o campo
    contact_id                 = case when _quote_patch ? 'contact_id'
                                      then nullif(_quote_patch->>'contact_id','')::uuid
                                      else contact_id end,
    client_name                = coalesce(nullif(_quote_patch->>'client_name',''), client_name),
    -- BUG-C FIX: campos nullable devem ser limpáveis; usa ? em vez de COALESCE
    client_email               = case when _quote_patch ? 'client_email'
                                      then nullif(_quote_patch->>'client_email','')
                                      else client_email end,
    client_phone               = case when _quote_patch ? 'client_phone'
                                      then nullif(_quote_patch->>'client_phone','')
                                      else client_phone end,
    client_company             = case when _quote_patch ? 'client_company'
                                      then nullif(_quote_patch->>'client_company','')
                                      else client_company end,
    status                     = coalesce(_quote_patch->>'status',         status),
    shipping_type              = coalesce(_quote_patch->>'shipping_type',  shipping_type),
    shipping_cost              = coalesce((_quote_patch->>'shipping_cost')::numeric,               shipping_cost),
    payment_method             = coalesce(_quote_patch->>'payment_method', payment_method),
    payment_terms              = coalesce(_quote_patch->>'payment_terms',  payment_terms),
    delivery_time              = coalesce(_quote_patch->>'delivery_time',  delivery_time),
    notes                      = case when _quote_patch ? 'notes'
                                      then nullif(_quote_patch->>'notes','')
                                      else notes end,
    internal_notes             = case when _quote_patch ? 'internal_notes'
                                      then nullif(_quote_patch->>'internal_notes','')
                                      else internal_notes end,
    discount_percent           = coalesce((_quote_patch->>'discount_percent')::numeric,            discount_percent),
    discount_amount            = coalesce((_quote_patch->>'discount_amount')::numeric,             discount_amount),
    subtotal                   = coalesce((_quote_patch->>'subtotal')::numeric,                    subtotal),
    total                      = coalesce((_quote_patch->>'total')::numeric,                       total),
    negotiation_markup_percent = coalesce((_quote_patch->>'negotiation_markup_percent')::numeric,  negotiation_markup_percent),
    -- BUG-C FIX: valid_until deve ser limpável (usuário pode remover prazo)
    valid_until                = case when _quote_patch ? 'valid_until'
                                      then nullif(_quote_patch->>'valid_until','')::date
                                      else valid_until end,
    updated_at                 = now()
  where id = _quote_id
  returning * into _updated_quote;

  if _updated_quote is null then
    raise exception 'Orçamento não encontrado: %', _quote_id
      using errcode = 'no_data_found';
  end if;

  delete from public.quote_item_personalizations
  where quote_item_id in (
    select id from public.quote_items where quote_id = _quote_id
  );
  delete from public.quote_items where quote_id = _quote_id;

  for _item in select value from jsonb_array_elements(coalesce(_items,'[]'::jsonb)) loop
    -- BUG-B FIX: adicionado bitrix_product_id, price_confirmed_at,
    --            price_freshness_threshold_days, price_updated_at
    insert into public.quote_items (
      quote_id, product_id, product_name, product_sku, product_image_url,
      quantity, unit_price, subtotal, discount_percentage, discount_amount,
      color_name, color_hex, size_code, gender,
      sort_order, notes, kit_group_id, kit_name,
      bitrix_product_id,
      price_confirmed_at,
      price_freshness_threshold_days,
      price_updated_at
    )
    values (
      _quote_id,
      nullif(_item->>'product_id','')::uuid,
      _item->>'product_name',
      _item->>'product_sku',
      _item->>'product_image_url',
      coalesce((_item->>'quantity')::integer,0),
      coalesce((_item->>'unit_price')::numeric,0),
      coalesce((_item->>'subtotal')::numeric,0),
      coalesce((_item->>'discount_percentage')::numeric,0),
      coalesce((_item->>'discount_amount')::numeric,0),
      _item->>'color_name', _item->>'color_hex',
      nullif(_item->>'size_code',''), nullif(_item->>'gender',''),
      coalesce((_item->>'sort_order')::integer,0),
      _item->>'notes',
      nullif(_item->>'kit_group_id','')::uuid,
      nullif(_item->>'kit_name',''),
      nullif(_item->>'bitrix_product_id',''),
      nullif(_item->>'price_confirmed_at','')::timestamptz,
      nullif(_item->>'price_freshness_threshold_days','')::integer,
      nullif(_item->>'price_updated_at','')::timestamptz
    )
    returning id into _new_item_id;

    for _pers in select value from jsonb_array_elements(coalesce(_item->'personalizations','[]'::jsonb)) loop
      insert into public.quote_item_personalizations (
        quote_item_id, technique_id, technique_name,
        location_code, location_name,
        personalized_quantity, colors_count, positions_count,
        area_cm2, width_cm, height_cm,
        setup_cost, unit_cost, total_cost, notes
      )
      values (
        _new_item_id,
        nullif(_pers->>'technique_id','')::uuid,
        _pers->>'technique_name',
        _pers->>'location_code', _pers->>'location_name',
        nullif(_pers->>'personalized_quantity','')::integer,
        coalesce((_pers->>'colors_count')::integer,1),
        coalesce((_pers->>'positions_count')::integer,1),
        nullif(_pers->>'area_cm2','')::numeric,
        nullif(_pers->>'width_cm','')::numeric,
        nullif(_pers->>'height_cm','')::numeric,
        coalesce((_pers->>'setup_cost')::numeric,0),
        coalesce((_pers->>'unit_cost')::numeric,0),
        coalesce((_pers->>'total_cost')::numeric,0),
        _pers->>'notes'
      );
    end loop;
  end loop;

  return _updated_quote;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. fn_create_quote_v3 — adiciona contact_id no INSERT de quotes
--    e price_confirmed_at, price_freshness_threshold_days, price_updated_at
--    no INSERT de quote_items (BUG-D)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_create_quote_v3(p_quote_data jsonb, p_items_data jsonb)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
    v_quote_id     uuid;
    v_item         record;
    v_pers         record;
    v_new_item_id  uuid;
    v_seller_id    uuid := auth.uid();
    v_quote_number text;
begin
    if v_seller_id is null then raise exception 'Unauthorized'; end if;

    -- BUG-D FIX: adicionado contact_id à lista de colunas e valores
    insert into public.quotes (
        seller_id, client_id, contact_id,
        client_name, client_email, client_phone, client_company, client_cnpj,
        status, subtotal, discount_percent, discount_amount, total,
        notes, internal_notes, valid_until, payment_terms, delivery_time,
        shipping_type, shipping_cost, negotiation_markup_percent, organization_id
    ) values (
        v_seller_id,
        nullif(p_quote_data->>'client_id','')::uuid,
        nullif(p_quote_data->>'contact_id','')::uuid,
        (p_quote_data->>'client_name'),
        (p_quote_data->>'client_email'),
        (p_quote_data->>'client_phone'),
        (p_quote_data->>'client_company'),
        (p_quote_data->>'client_cnpj'),
        coalesce(p_quote_data->>'status', 'draft'),
        (p_quote_data->>'subtotal')::numeric,
        coalesce((p_quote_data->>'discount_percent')::numeric, 0),
        coalesce((p_quote_data->>'discount_amount')::numeric, 0),
        (p_quote_data->>'total')::numeric,
        (p_quote_data->>'notes'),
        (p_quote_data->>'internal_notes'),
        nullif(p_quote_data->>'valid_until','')::timestamptz,
        (p_quote_data->>'payment_terms'),
        (p_quote_data->>'delivery_time'),
        (p_quote_data->>'shipping_type'),
        coalesce((p_quote_data->>'shipping_cost')::numeric, 0),
        coalesce((p_quote_data->>'negotiation_markup_percent')::numeric, 0),
        nullif(p_quote_data->>'organization_id','')::uuid
    ) returning id, quote_number into v_quote_id, v_quote_number;

    for v_item in select * from jsonb_array_elements(p_items_data) loop
        -- BUG-D FIX: adicionado price_confirmed_at, price_freshness_threshold_days,
        --            price_updated_at (bitrix_product_id já existia)
        insert into public.quote_items (
            quote_id, product_id, product_name, product_sku, product_image_url,
            quantity, unit_price, subtotal, discount_percentage, discount_amount,
            color_name, color_hex, size_code, gender,
            bitrix_product_id, sort_order, notes,
            price_confirmed_at,
            price_freshness_threshold_days,
            price_updated_at
        ) values (
            v_quote_id,
            nullif(v_item.value->>'product_id','')::uuid,
            (v_item.value->>'product_name'),
            (v_item.value->>'product_sku'),
            (v_item.value->>'product_image_url'),
            coalesce((v_item.value->>'quantity')::integer, 0),
            coalesce((v_item.value->>'unit_price')::numeric, 0),
            (v_item.value->>'subtotal')::numeric,
            coalesce((v_item.value->>'discount_percentage')::numeric, 0),
            coalesce((v_item.value->>'discount_amount')::numeric, 0),
            (v_item.value->>'color_name'),
            (v_item.value->>'color_hex'),
            nullif(v_item.value->>'size_code',''),
            nullif(v_item.value->>'gender',''),
            nullif(v_item.value->>'bitrix_product_id',''),
            coalesce((v_item.value->>'sort_order')::integer, 0),
            (v_item.value->>'notes'),
            nullif(v_item.value->>'price_confirmed_at','')::timestamptz,
            nullif(v_item.value->>'price_freshness_threshold_days','')::integer,
            nullif(v_item.value->>'price_updated_at','')::timestamptz
        ) returning id into v_new_item_id;

        if v_item.value ? 'personalizations' then
            for v_pers in select * from jsonb_array_elements(v_item.value->'personalizations') loop
                insert into public.quote_item_personalizations (
                    quote_item_id, technique_id, technique_name,
                    colors_count, positions_count, area_cm2, width_cm, height_cm,
                    setup_cost, unit_cost, total_cost, notes
                ) values (
                    v_new_item_id,
                    nullif(v_pers.value->>'technique_id','')::uuid,
                    (v_pers.value->>'technique_name'),
                    coalesce((v_pers.value->>'colors_count')::integer, 1),
                    coalesce((v_pers.value->>'positions_count')::integer, 1),
                    nullif(v_pers.value->>'area_cm2','')::numeric,
                    nullif(v_pers.value->>'width_cm','')::numeric,
                    nullif(v_pers.value->>'height_cm','')::numeric,
                    coalesce((v_pers.value->>'setup_cost')::numeric, 0),
                    coalesce((v_pers.value->>'unit_cost')::numeric, 0),
                    coalesce((v_pers.value->>'total_cost')::numeric, 0),
                    (v_pers.value->>'notes')
                );
            end loop;
        end if;
    end loop;

    insert into public.quote_history (quote_id, user_id, action, description)
    values (v_quote_id, v_seller_id, 'created_v3', 'Orçamento criado via RPC atômico');

    return jsonb_build_object('id', v_quote_id, 'quote_number', v_quote_number);
end;
$function$;
