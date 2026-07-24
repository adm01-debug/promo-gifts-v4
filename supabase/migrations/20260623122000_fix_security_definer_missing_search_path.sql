-- =============================================================================
-- FIX: 3 funções SECURITY DEFINER sem SET search_path → adicionar search_path
-- =============================================================================
-- VULNERABILIDADE: SECURITY DEFINER sem search_path explícito permite
-- schema injection. FIX: adicionar SET search_path = public.
-- Funções afetadas: fn_quotes_validate_discount, fn_rebuild_color_swatches,
-- notify_quote_status_change (todas acessam apenas public).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_quotes_validate_discount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _max_allowed numeric;
  _real_discount_pct numeric;
  _has_valid_approval boolean;
  _current_hash text;
  _seller_id uuid;
  _msg text;
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  _seller_id := COALESCE(NEW.seller_id, NEW.created_by);

  IF _seller_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_coord_or_above(_seller_id) THEN
    RETURN NEW;
  END IF;

  _real_discount_pct := COALESCE(NEW.real_discount_percent, 0);

  IF _real_discount_pct <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT max_discount_percent INTO _max_allowed
  FROM public.seller_discount_limits
  WHERE user_id = _seller_id;

  IF _max_allowed IS NULL THEN
    RAISE EXCEPTION 'Vendedor sem limite de desconto cadastrado. Solicite ao admin que configure seu limite antes de salvar orcamentos.'
      USING ERRCODE = '23514';
  END IF;

  IF _real_discount_pct <= _max_allowed THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.status, 'draft') = 'pending_approval' THEN
      RETURN NEW;
    END IF;
    _msg := 'Desconto de ' || ROUND(_real_discount_pct, 2)::text ||
            ' por cento acima do seu limite de ' || ROUND(_max_allowed, 2)::text ||
            ' por cento. Para solicitar aprovacao, use o botao "Solicitar aprovacao ao coordenador"' ||
            ' que cria o orcamento em status pendente.';
    RAISE EXCEPTION '%', _msg USING ERRCODE = '23514';
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

  IF _has_valid_approval THEN
    RETURN NEW;
  END IF;

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

  IF COALESCE(NEW.status, 'draft') = 'pending_approval' THEN
    RETURN NEW;
  END IF;

  _msg := 'Desconto de ' || ROUND(_real_discount_pct, 2)::text ||
          ' por cento acima do seu limite de ' || ROUND(_max_allowed, 2)::text ||
          ' por cento. Solicite aprovacao ao coordenador antes de salvar.';
  RAISE EXCEPTION '%', _msg USING ERRCODE = '23514';
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_rebuild_color_swatches(p_product_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COALESCE(
    jsonb_agg(
      swatch
      ORDER BY (swatch->>'stock_quantity')::int DESC, swatch->>'color_name' ASC
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT DISTINCT ON (agg.color_id)
      jsonb_build_object(
        'variant_id',     agg.lead_variant_id,
        'sku',            agg.lead_sku,
        'color_id',       agg.color_id,
        'color_name',     agg.color_name,
        'color_hex',      agg.color_hex,
        'stock_quantity', agg.total_stock,
        'is_in_stock',    agg.total_stock > 0,
        'image_url',      COALESCE(
          (SELECT pi.url_cdn FROM product_images pi
           WHERE pi.product_id=p_product_id AND pi.variant_id=agg.lead_variant_id
             AND pi.is_active=true AND pi.image_type IN ('main','gallery','product')
           ORDER BY pi.is_primary DESC, pi.display_order ASC NULLS LAST LIMIT 1),
          (SELECT pi.url_cdn FROM product_images pi
           WHERE pi.product_id=p_product_id AND pi.color_id=agg.color_id
             AND pi.variant_id IS NULL AND pi.is_active=true
             AND pi.image_type IN ('main','gallery','product')
           ORDER BY pi.is_primary DESC, pi.display_order ASC NULLS LAST LIMIT 1),
          (SELECT pi.url_cdn FROM product_images pi
           WHERE pi.product_id=p_product_id AND pi.color_id=agg.color_id
             AND pi.variant_id IS NOT NULL AND pi.is_active=true
             AND pi.image_type IN ('main','gallery','product')
           ORDER BY pi.is_primary DESC, pi.display_order ASC NULLS LAST LIMIT 1),
          agg.lead_images_first,
          (SELECT p.primary_image_url FROM products p WHERE p.id = p_product_id)
        )
      ) AS swatch
    FROM (
      SELECT pv2.color_id,
        COALESCE(pv2.color_name, cv.name) AS color_name,
        COALESCE(pv2.color_hex, cv.hex_code) AS color_hex,
        SUM(COALESCE(pv2.stock_quantity, 0)) AS total_stock,
        (ARRAY_AGG(pv2.id   ORDER BY COALESCE(pv2.stock_quantity,0) DESC, pv2.sku ASC))[1] AS lead_variant_id,
        (ARRAY_AGG(pv2.sku  ORDER BY COALESCE(pv2.stock_quantity,0) DESC, pv2.sku ASC))[1] AS lead_sku,
        (ARRAY_AGG(pv2.images->>0 ORDER BY COALESCE(pv2.stock_quantity,0) DESC, pv2.sku ASC))[1] AS lead_images_first
      FROM product_variants pv2
      LEFT JOIN color_variations cv ON cv.id = pv2.color_id
      WHERE pv2.product_id = p_product_id AND pv2.is_active = true AND pv2.color_id IS NOT NULL
      GROUP BY pv2.color_id, COALESCE(pv2.color_name, cv.name), COALESCE(pv2.color_hex, cv.hex_code)
    ) agg
    ORDER BY agg.color_id, agg.total_stock DESC
  ) sub;
$function$;

CREATE OR REPLACE FUNCTION public.notify_quote_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

NOTIFY pgrst, 'reload schema';
