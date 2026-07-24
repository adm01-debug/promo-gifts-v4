-- APLICADO 2026-06-21 (via Supabase MCP execute_sql no projeto doufsxqlfjyuvxuezpln).
-- Este arquivo DOCUMENTA uma migração já aplicada em produção (convenção do time:
-- aplicar via execute_sql/apply_migration e versionar o .sql com header "APLICADO").
--
-- CONTEXTO / BUG
--   Sintoma em produção: ao finalizar "Novo Orçamento" o sistema exibia
--   "Erro ao criar orçamento" e não gerava preview nem PDF.
--   Causa-raiz: o front-end enviava organization_id de uma org FANTASMA
--   (35c6a2a6-…, seed de preview-snapshot inexistente em public.organizations).
--   A policy RLS de INSERT em public.quotes (org_members_create_quotes) exige
--   user_is_org_member(organization_id); com org inválida/nula o INSERT era
--   bloqueado ("new row violates row-level security policy for table quotes"),
--   e todo o fluxo a jusante (preview + PDF, que são client-side e só ocorrem
--   após a criação) ficava inacessível.
--
-- CORREÇÃO (defesa em profundidade, independente do estado do client)
--   create_quote_transactional passa a resolver, no servidor, a partir de auth.uid():
--     • organization_id: usa o enviado SE o usuário for membro; senão faz fallback
--       para a organização mais antiga do usuário em public.user_organizations.
--     • seller_id: default = auth.uid() quando ausente.
--     • created_by: passa a ser preenchido (antes nunca era setado).
--   Mantida como SECURITY INVOKER (RLS continua valendo). Se nenhuma org puder ser
--   resolvida, levanta 23502 com mensagem clara em vez de violar a RLS silenciosamente.
--
-- VALIDAÇÃO
--   Testado E2E sob role=authenticated (RLS ativa) com a org omitida E com a org
--   fantasma 35c6a2a6-…: em ambos resolveu para 5db5aee1-… e criou orçamento + itens.
--   23/23 fn_run_smoke_tests() PASS. Zero linhas de teste vazadas (rollback).

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
  _uid          uuid := auth.uid();
  _org_id       uuid := nullif(_quote->>'organization_id', '')::uuid;
  _seller_id    uuid := nullif(_quote->>'seller_id', '')::uuid;
BEGIN
  -- Resolução server-side de organização/vendedor (independe do estado do client)
  IF _uid IS NOT NULL THEN
    IF _org_id IS NULL OR NOT public.user_is_org_member(_org_id) THEN
      SELECT uo.organization_id INTO _org_id
      FROM public.user_organizations uo
      WHERE uo.user_id = _uid
      ORDER BY uo.created_at ASC, uo.organization_id ASC
      LIMIT 1;
    END IF;
    IF _seller_id IS NULL THEN
      _seller_id := _uid;
    END IF;
  END IF;

  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível determinar a organização do orçamento: usuário sem organização vinculada.'
      USING ERRCODE = '23502';
  END IF;

  INSERT INTO public.quotes (
    quote_number, client_id, contact_id,
    client_name, client_email, client_phone, client_company, client_cnpj,
    seller_id, created_by, organization_id, status,
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
    nullif(_quote->>'client_cnpj', ''),
    _seller_id,
    coalesce(_uid, _seller_id),
    _org_id,
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

  SELECT * INTO _new_quote FROM public.quotes WHERE id = _new_quote_id;

  _actor_id := coalesce(_uid, _seller_id);
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
        'status',  _new_quote.status,
        'subtotal',_new_quote.subtotal,
        'total',   _new_quote.total,
        'markup',  _new_quote.negotiation_markup_percent,
        'n_items', (SELECT count(*) FROM public.quote_items WHERE quote_id = _new_quote_id)
      )
    );
  END IF;

  RETURN _new_quote;
END;
$function$;
