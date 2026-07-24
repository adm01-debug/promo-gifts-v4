-- ============================================================
-- FIX QBP-01: fn_quotes_validate_discount permite pending_approval no INSERT
-- FIX QBP-02: compute_quote_snapshot_hash sem IDs voláteis de itens
-- FIX QBP-04: qip_update_own_quote com is_coord_or_above
-- FIX QBP-06: notify_quote_status_change cobre pending_approval/converted/cancelled
-- Auditoria Módulo Novo Orçamento: 2026-06-22
-- Aplicados diretamente via Supabase MCP na sessão de auditoria.
-- Esta migration registra os DDLs para rastreabilidade do histórico.
-- ============================================================

-- FIX QBP-02: compute_quote_snapshot_hash sem IDs voláteis --------
CREATE OR REPLACE FUNCTION public.compute_quote_snapshot_hash(_quote_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY INVOKER
AS $fnbody$
DECLARE
  _hash_input text;
  _quote_data text;
  _items_data text;
  _personalizations_data text;
BEGIN
  SELECT
    COALESCE(client_id::text, '') || '|' ||
    COALESCE(client_name, '') || '|' ||
    COALESCE(subtotal::text, '0') || '|' ||
    COALESCE(discount_percent::text, '0') || '|' ||
    COALESCE(discount_amount::text, '0') || '|' ||
    COALESCE(negotiation_markup_percent::text, '0') || '|' ||
    COALESCE(total::text, '0')
  INTO _quote_data
  FROM public.quotes
  WHERE id = _quote_id;

  -- QBP-02 FIX: usa product_id+sku+qty+preço+sort_order (sem qi.id volátil).
  -- update_quote_transactional faz DELETE+reinsert de itens, gerando novos UUIDs.
  -- Com qi.id no hash, qualquer edição invalidava aprovações anteriores.
  SELECT COALESCE(string_agg(
    COALESCE(qi.product_id::text, '') || ':' ||
    COALESCE(qi.product_sku, '') || ':' ||
    COALESCE(qi.quantity::text, '0') || ':' ||
    COALESCE(qi.unit_price::text, '0') || ':' ||
    COALESCE(qi.subtotal::text, '0'),
    '|' ORDER BY qi.sort_order, qi.product_id
  ), '') INTO _items_data
  FROM public.quote_items qi
  WHERE qi.quote_id = _quote_id;

  -- QBP-02 FIX: technique/qty/cost sem qip.id volátil.
  SELECT COALESCE(string_agg(
    COALESCE(qip.technique_id::text, '') || ':' ||
    COALESCE(qip.colors_count::text, '0') || ':' ||
    COALESCE(qip.positions_count::text, '0') || ':' ||
    COALESCE(qip.total_cost::text, '0'),
    '|' ORDER BY qi.sort_order, qip.technique_id
  ), '') INTO _personalizations_data
  FROM public.quote_item_personalizations qip
  JOIN public.quote_items qi ON qi.id = qip.quote_item_id
  WHERE qi.quote_id = _quote_id;

  _hash_input := COALESCE(_quote_data, '') || '||' ||
                 COALESCE(_items_data, '') || '||' ||
                 COALESCE(_personalizations_data, '');

  RETURN encode(extensions.digest(_hash_input, 'sha1'), 'hex');
END;
$fnbody$;

COMMENT ON FUNCTION public.compute_quote_snapshot_hash IS
  'FIX QBP-02 (2026-06-22): Removidos qi.id e qip.id do hash. UUIDs eram regenerados no update_quote_transactional (delete+reinsert), invalidando aprovações mesmo sem mudanças financeiras.';

-- FIX QBP-01: fn_quotes_validate_discount --------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_quotes_validate_discount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $fnbody$
DECLARE
  _max_allowed numeric;
  _real_discount_pct numeric;
  _has_valid_approval boolean;
  _current_hash text;
  _seller_id uuid;
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  _seller_id := COALESCE(NEW.seller_id, NEW.created_by);
  IF _seller_id IS NULL THEN RETURN NEW; END IF;
  IF public.is_coord_or_above(_seller_id) THEN RETURN NEW; END IF;

  _real_discount_pct := COALESCE(NEW.real_discount_percent, 0);
  IF _real_discount_pct <= 0 THEN RETURN NEW; END IF;

  SELECT max_discount_percent INTO _max_allowed
  FROM public.seller_discount_limits
  WHERE user_id = _seller_id;

  IF _max_allowed IS NULL THEN
    RAISE EXCEPTION 'Vendedor sem limite de desconto cadastrado. Solicite ao admin que configure seu limite antes de salvar orcamentos.'
      USING ERRCODE = '23514';
  END IF;

  IF _real_discount_pct <= _max_allowed THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    -- QBP-01 FIX: INSERT com status pending_approval inicia fluxo de aprovação.
    -- O orçamento fica bloqueado para envio até o coordenador aprovar.
    IF COALESCE(NEW.status, 'draft') = 'pending_approval' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Desconto de % por cento acima do seu limite de % por cento. Para solicitar aprovacao, use o botao "Solicitar aprovacao ao coordenador".',
      ROUND(_real_discount_pct, 2), ROUND(_max_allowed, 2)
      USING ERRCODE = '23514';
  END IF;

  _current_hash := public.compute_quote_snapshot_hash(NEW.id);

  SELECT EXISTS (
    SELECT 1 FROM public.discount_approval_requests
    WHERE quote_id = NEW.id
      AND status = 'approved'
      AND (valid_until IS NULL OR valid_until > now())
      AND requested_discount_percent >= _real_discount_pct
      AND quote_snapshot_hash = _current_hash
  ) INTO _has_valid_approval;

  IF _has_valid_approval THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.discount_approval_requests
    WHERE quote_id = NEW.id AND status = 'approved'
      AND (
        (valid_until IS NOT NULL AND valid_until <= now())
        OR quote_snapshot_hash <> _current_hash
      )
  ) THEN
    RAISE EXCEPTION 'Aprovacao anterior nao vale mais (orcamento foi alterado ou aprovacao expirou). Solicite nova aprovacao ao coordenador.'
      USING ERRCODE = '23514';
  END IF;

  -- QBP-01 FIX: UPDATE para pending_approval sem aprovação = aguardando (ok).
  IF COALESCE(NEW.status, 'draft') = 'pending_approval' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Desconto de % por cento acima do seu limite de % por cento. Solicite aprovacao ao coordenador antes de salvar.',
    ROUND(_real_discount_pct, 2), ROUND(_max_allowed, 2)
    USING ERRCODE = '23514';
END;
$fnbody$;

COMMENT ON FUNCTION public.fn_quotes_validate_discount IS
  'FIX QBP-01 (2026-06-22): INSERT com status pending_approval agora permitido para iniciar fluxo de aprovação de desconto.';

-- FIX QBP-04: qip_update_own_quote com is_coord_or_above ---------------------------
DROP POLICY IF EXISTS qip_update_own_quote ON public.quote_item_personalizations;

CREATE POLICY qip_update_own_quote ON public.quote_item_personalizations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quote_items qi
      JOIN public.quotes q ON q.id = qi.quote_id
      WHERE qi.id = quote_item_personalizations.quote_item_id
        AND (
          q.seller_id = (SELECT auth.uid() AS uid)
          OR is_coord_or_above((SELECT auth.uid() AS uid))
        )
    )
  );

COMMENT ON POLICY qip_update_own_quote ON public.quote_item_personalizations IS
  'FIX QBP-04 (2026-06-22): Adicionado is_coord_or_above — coordenadores podem atualizar personalizações de qualquer orçamento (simetria com INSERT/DELETE).';

-- FIX QBP-06: notify_quote_status_change cobre pending_approval/converted/cancelled --
CREATE OR REPLACE FUNCTION public.notify_quote_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $fnbody$
DECLARE
  notif_title TEXT;
  notif_message TEXT;
  notif_type TEXT;
  notif_category TEXT := 'quotes';
  notif_url TEXT := '/orcamentos';
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  CASE NEW.status
    WHEN 'approved' THEN
      notif_title   := '✅ Orçamento aprovado!';
      notif_message := 'O orçamento ' || NEW.quote_number || COALESCE(' de ' || NEW.client_name, '') || ' foi aprovado!';
      notif_type    := 'success';
    WHEN 'rejected' THEN
      notif_title   := '❌ Orçamento recusado';
      notif_message := 'O orçamento ' || NEW.quote_number || COALESCE(' de ' || NEW.client_name, '') || ' foi recusado.';
      notif_type    := 'warning';
    WHEN 'sent' THEN
      notif_title   := '📤 Orçamento enviado';
      notif_message := 'O orçamento ' || NEW.quote_number || ' foi marcado como enviado.';
      notif_type    := 'info';
    WHEN 'expired' THEN
      notif_title   := '⏰ Orçamento expirado';
      notif_message := 'O orçamento ' || NEW.quote_number || COALESCE(' de ' || NEW.client_name, '') || ' expirou.';
      notif_type    := 'warning';
    -- QBP-06 FIX: status anteriormente ausentes
    WHEN 'pending_approval' THEN
      notif_title   := '⏳ Orçamento aguardando aprovação';
      notif_message := 'O orçamento ' || NEW.quote_number || ' foi submetido para aprovação de desconto.';
      notif_type    := 'info';
    WHEN 'converted' THEN
      notif_title   := '🎉 Orçamento convertido em pedido!';
      notif_message := 'O orçamento ' || NEW.quote_number || COALESCE(' de ' || NEW.client_name, '') || ' foi convertido em pedido.';
      notif_type    := 'success';
      notif_url     := '/pedidos';
    WHEN 'cancelled' THEN
      notif_title   := '🚫 Orçamento cancelado';
      notif_message := 'O orçamento ' || NEW.quote_number || COALESCE(' de ' || NEW.client_name, '') || ' foi cancelado.';
      notif_type    := 'warning';
    ELSE
      RETURN NEW;
  END CASE;

  IF NEW.seller_id IS NOT NULL THEN
    INSERT INTO public.workspace_notifications (user_id, title, message, type, category, action_url)
    VALUES (NEW.seller_id, notif_title, notif_message, notif_type, notif_category, notif_url);
  END IF;

  RETURN NEW;
END;
$fnbody$;

COMMENT ON FUNCTION public.notify_quote_status_change IS
  'FIX QBP-06 (2026-06-22): Adicionadas notificações para pending_approval, converted e cancelled.';
