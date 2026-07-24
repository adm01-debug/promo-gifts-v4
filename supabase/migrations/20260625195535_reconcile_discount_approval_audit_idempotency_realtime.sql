-- RECONCILIAÇÃO das migrations Lovable não-aplicadas em produção (2026-06-25)
-- Migrations 20260625161934 / 162653 / 181704 foram commitadas no repo mas NÃO
-- executaram em produção. Esta migration aplica a parte segura e CORRIGE a armadilha
-- de notificação duplicada: a parte de notificação da 161934 é DELIBERADAMENTE OMITIDA
-- porque duplicaria o trigger existente trg_notify_discount_approval.
-- Aplicada em produção via apply_migration (version 20260625195535) e verificada
-- (18/18 checagens + teste adversarial: sem dobro, auditoria correta, idempotência 23505).
-- Idempotente: seguro re-rodar.

-- ===== PARTE 1: AUDITORIA (de 161934, somente parte segura) =====
CREATE TABLE IF NOT EXISTS public.discount_approval_audit (
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
COMMENT ON TABLE public.discount_approval_audit IS
  'Trilha de auditoria de aprovações de desconto. Reconciliada em 2026-06-25 '
  '(migration Lovable 20260625161934 nunca aplicou em produção). Escrita apenas via trigger definer.';
GRANT SELECT ON public.discount_approval_audit TO authenticated;
GRANT ALL ON public.discount_approval_audit TO service_role;
ALTER TABLE public.discount_approval_audit ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_daa_request_created ON public.discount_approval_audit(request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daa_quote_created   ON public.discount_approval_audit(quote_id,   created_at DESC);

DROP POLICY IF EXISTS "daa_select_scope" ON public.discount_approval_audit;
CREATE POLICY "daa_select_scope" ON public.discount_approval_audit
  FOR SELECT TO authenticated
  USING (
    public.can_view_all_sales()
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR EXISTS (SELECT 1 FROM public.discount_approval_requests r
               WHERE r.id = discount_approval_audit.request_id AND r.seller_id = auth.uid())
  );
DROP POLICY IF EXISTS "daa_no_direct_write_insert" ON public.discount_approval_audit;
CREATE POLICY "daa_no_direct_write_insert" ON public.discount_approval_audit FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "daa_no_direct_write_update" ON public.discount_approval_audit;
CREATE POLICY "daa_no_direct_write_update" ON public.discount_approval_audit FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "daa_no_direct_write_delete" ON public.discount_approval_audit;
CREATE POLICY "daa_no_direct_write_delete" ON public.discount_approval_audit FOR DELETE TO authenticated USING (false);

CREATE OR REPLACE FUNCTION public.fn_audit_discount_approval()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event text; v_actor_role text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'requested'; v_actor_role := 'seller';
    INSERT INTO public.discount_approval_audit(request_id, quote_id, actor_id, actor_role, event, requested_discount_percent, max_allowed_percent, seller_notes)
    VALUES (NEW.id, NEW.quote_id, NEW.seller_id, v_actor_role, v_event, NEW.requested_discount_percent, NEW.max_allowed_percent, NEW.seller_notes);
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('approved','rejected','expired','cancelled') THEN
      v_event := NEW.status;
      v_actor_role := CASE
        WHEN NEW.admin_id IS NOT NULL AND public.has_role(NEW.admin_id, 'supervisor'::app_role) THEN 'supervisor'
        WHEN NEW.admin_id IS NOT NULL THEN 'admin' ELSE 'system' END;
      INSERT INTO public.discount_approval_audit(request_id, quote_id, actor_id, actor_role, event, requested_discount_percent, max_allowed_percent, admin_notes, seller_notes)
      VALUES (NEW.id, NEW.quote_id, NEW.admin_id, v_actor_role, v_event, NEW.requested_discount_percent, NEW.max_allowed_percent, NEW.admin_notes, NEW.seller_notes);
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.fn_audit_discount_approval() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_audit_discount_approval ON public.discount_approval_requests;
CREATE TRIGGER trg_audit_discount_approval AFTER INSERT OR UPDATE ON public.discount_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_discount_approval();

-- ===== PARTE 2: IDEMPOTÊNCIA (de 162653) =====
CREATE UNIQUE INDEX IF NOT EXISTS uniq_dar_quote_pending
  ON public.discount_approval_requests (quote_id) WHERE status = 'pending';
COMMENT ON INDEX public.uniq_dar_quote_pending IS
  'Idempotencia: no maximo 1 pending por quote_id (segundo INSERT concorrente -> 23505, client trata como sucesso). Reconciliado 2026-06-25.';

-- ===== PARTE 3: REALTIME FULL (de 181704, parte faltante) =====
ALTER TABLE public.discount_approval_requests REPLICA IDENTITY FULL;

-- ===== PARTE 4: completar deeplink na notificacao EXISTENTE (sem duplicar trigger) =====
CREATE OR REPLACE FUNCTION public.notify_discount_approval_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE seller_name TEXT; quote_num TEXT; admin_user RECORD;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT full_name INTO seller_name FROM public.profiles WHERE user_id = NEW.seller_id;
    SELECT quote_number INTO quote_num FROM public.quotes WHERE id = NEW.quote_id;
    FOR admin_user IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' LOOP
      INSERT INTO public.workspace_notifications (user_id, title, message, type, category, action_url, metadata)
      VALUES (admin_user.user_id, '⚠️ Desconto acima do limite',
        COALESCE(seller_name, 'Vendedor') || ' solicitou ' || NEW.requested_discount_percent || '% de desconto no orçamento ' || COALESCE(quote_num, '') || ' (limite: ' || NEW.max_allowed_percent || '%).',
        'warning', 'quotes',
        '/admin/usuarios?tab=discounts&request=' || NEW.id::text,
        jsonb_build_object('request_id', NEW.id, 'quote_id', NEW.quote_id, 'quote_number', quote_num, 'seller_id', NEW.seller_id, 'requested_pct', NEW.requested_discount_percent, 'max_pct', NEW.max_allowed_percent));
    END LOOP;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    SELECT quote_number INTO quote_num FROM public.quotes WHERE id = NEW.quote_id;
    IF NEW.status = 'approved' THEN
      INSERT INTO public.workspace_notifications (user_id, title, message, type, category, action_url, metadata)
      VALUES (NEW.seller_id, '✅ Desconto aprovado!',
        'Seu desconto de ' || NEW.requested_discount_percent || '% no orçamento ' || COALESCE(quote_num, '') || ' foi aprovado.',
        'success', 'quotes', '/orcamentos',
        jsonb_build_object('request_id', NEW.id, 'quote_id', NEW.quote_id, 'quote_number', quote_num));
    ELSE
      INSERT INTO public.workspace_notifications (user_id, title, message, type, category, action_url, metadata)
      VALUES (NEW.seller_id, '❌ Desconto recusado',
        'Seu desconto de ' || NEW.requested_discount_percent || '% no orçamento ' || COALESCE(quote_num, '') || ' foi recusado.' || COALESCE(' Motivo: ' || NEW.admin_notes, ''),
        'warning', 'quotes', '/orcamentos',
        jsonb_build_object('request_id', NEW.id, 'quote_id', NEW.quote_id, 'quote_number', quote_num));
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
