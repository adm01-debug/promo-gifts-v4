-- MELHORIA 4/4: enforca que toda solicitacao de aprovacao NASCE com status 'pending'.
-- Fecha o edge case: INSERT direto nao-pending registrava auditoria 'requested' inconsistente e NAO
-- notificava admin. O app (useDiscountApproval.ts L130) nunca seta status -> depende do DEFAULT 'pending',
-- entao o trigger eh transparente. approved/rejected/expired continuam sendo UPDATEs (trigger BEFORE INSERT).
-- anti-regressao (Lovable): manter este trigger BEFORE INSERT. fix_version=20260625_m4
CREATE OR REPLACE FUNCTION public.fn_dar_enforce_initial_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'discount_approval_requests deve nascer com status pending (recebido: %)', NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $function$;
DROP TRIGGER IF EXISTS trg_dar_enforce_initial_status ON public.discount_approval_requests;
CREATE TRIGGER trg_dar_enforce_initial_status
  BEFORE INSERT ON public.discount_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_dar_enforce_initial_status();
