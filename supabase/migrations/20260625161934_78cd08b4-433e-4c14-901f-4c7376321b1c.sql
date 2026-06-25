
-- 1) Tabela de auditoria
CREATE TABLE public.discount_approval_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.discount_approval_requests(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL,
  actor_id uuid,
  actor_role text NOT NULL CHECK (actor_role IN ('seller','admin','supervisor','system')),
  event text NOT NULL CHECK (event IN ('requested','approved','rejected','expired','superseded','cancelled')),
  requested_discount_percent numeric,
  max_allowed_percent numeric,
  real_discount_percent numeric,
  admin_notes text,
  seller_notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.discount_approval_audit TO authenticated;
GRANT ALL ON public.discount_approval_audit TO service_role;

ALTER TABLE public.discount_approval_audit ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_daa_request_created ON public.discount_approval_audit(request_id, created_at DESC);
CREATE INDEX idx_daa_quote_created   ON public.discount_approval_audit(quote_id,   created_at DESC);

-- SELECT: gestores (can_view_all_sales) e supervisores veem tudo;
-- vendedor vê auditoria das próprias solicitações.
CREATE POLICY "daa_select_scope"
  ON public.discount_approval_audit
  FOR SELECT TO authenticated
  USING (
    public.can_view_all_sales()
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.discount_approval_requests r
      WHERE r.id = discount_approval_audit.request_id
        AND r.seller_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE diretos: apenas service_role. Vendedores/admins
-- só escrevem via triggers (definer). Sem policy para authenticated.
CREATE POLICY "daa_no_direct_write_insert"
  ON public.discount_approval_audit
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "daa_no_direct_write_update"
  ON public.discount_approval_audit
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "daa_no_direct_write_delete"
  ON public.discount_approval_audit
  FOR DELETE TO authenticated USING (false);

-- 2) Trigger de auditoria: registra requested/approved/rejected
CREATE OR REPLACE FUNCTION public.fn_audit_discount_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text;
  v_actor_role text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'requested';
    v_actor_role := 'seller';
    INSERT INTO public.discount_approval_audit(
      request_id, quote_id, actor_id, actor_role, event,
      requested_discount_percent, max_allowed_percent,
      seller_notes
    ) VALUES (
      NEW.id, NEW.quote_id, NEW.seller_id, v_actor_role, v_event,
      NEW.requested_discount_percent, NEW.max_allowed_percent,
      NEW.seller_notes
    );
    RETURN NEW;
  END IF;

  -- UPDATE: registra somente quando status mudou para uma decisão.
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('approved','rejected','expired','cancelled') THEN
      v_event := NEW.status;
      v_actor_role := CASE
        WHEN NEW.admin_id IS NOT NULL AND public.has_role(NEW.admin_id, 'supervisor'::app_role)
          THEN 'supervisor'
        WHEN NEW.admin_id IS NOT NULL THEN 'admin'
        ELSE 'system'
      END;
      INSERT INTO public.discount_approval_audit(
        request_id, quote_id, actor_id, actor_role, event,
        requested_discount_percent, max_allowed_percent,
        admin_notes, seller_notes
      ) VALUES (
        NEW.id, NEW.quote_id, NEW.admin_id, v_actor_role, v_event,
        NEW.requested_discount_percent, NEW.max_allowed_percent,
        NEW.admin_notes, NEW.seller_notes
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_audit_discount_approval() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_discount_approval ON public.discount_approval_requests;
CREATE TRIGGER trg_audit_discount_approval
  AFTER INSERT OR UPDATE ON public.discount_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_discount_approval();

-- 3) Trigger de notificação ao gestor comercial
CREATE OR REPLACE FUNCTION public.fn_notify_discount_approval_requested()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote_number text;
  v_seller_name  text;
  v_title text;
  v_message text;
  v_action_url text;
  v_seller_notes_excerpt text;
  v_recipient_id uuid;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT q.quote_number INTO v_quote_number
    FROM public.quotes q WHERE q.id = NEW.quote_id;

  SELECT COALESCE(p.full_name, p.email, 'Vendedor') INTO v_seller_name
    FROM public.profiles p WHERE p.id = NEW.seller_id;

  v_seller_notes_excerpt := COALESCE(LEFT(NEW.seller_notes, 140), '');

  v_title := 'Novo pedido de aprovação de desconto';
  v_message := format(
    'Vendedor %s solicitou %s%% (limite %s%%) no orçamento %s.%s',
    COALESCE(v_seller_name, 'Vendedor'),
    trim(trailing '.' from to_char(NEW.requested_discount_percent, 'FM999990.99')),
    trim(trailing '.' from to_char(NEW.max_allowed_percent,        'FM999990.99')),
    COALESCE(v_quote_number, '—'),
    CASE WHEN length(v_seller_notes_excerpt) > 0
         THEN ' Justificativa: ' || v_seller_notes_excerpt
         ELSE ''
    END
  );
  v_action_url := '/admin/usuarios?tab=discounts&request=' || NEW.id::text;

  -- Destinatários: usuários distintos com roles admin OU dev OU supervisor.
  -- (can_view_all_sales é função; usamos roles diretas para coletar destinatários.)
  FOR v_recipient_id IN
    SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
     WHERE ur.role IN ('admin'::app_role, 'dev'::app_role, 'supervisor'::app_role)
  LOOP
    INSERT INTO public.workspace_notifications(
      user_id, title, message, type, category, action_url, metadata
    ) VALUES (
      v_recipient_id, v_title, v_message,
      'warning', 'approval', v_action_url,
      jsonb_build_object(
        'request_id', NEW.id,
        'quote_id', NEW.quote_id,
        'quote_number', v_quote_number,
        'seller_id', NEW.seller_id,
        'seller_name', v_seller_name,
        'requested_pct', NEW.requested_discount_percent,
        'max_pct', NEW.max_allowed_percent,
        'seller_notes', NEW.seller_notes
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_notify_discount_approval_requested() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_discount_approval_requested ON public.discount_approval_requests;
CREATE TRIGGER trg_notify_discount_approval_requested
  AFTER INSERT ON public.discount_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_discount_approval_requested();
