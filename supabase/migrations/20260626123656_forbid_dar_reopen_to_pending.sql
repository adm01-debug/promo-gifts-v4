-- Melhoria M6: máquina de estados — uma vez fora de 'pending', a solicitação não retorna.
-- App nunca reabre (decisões: approved/rejected; expired reservado). Para re-decidir, cria-se
-- nova solicitação (consistente com M4: nasce pending). Elimina o ponto cego de auditoria do
-- re-open: a transição simplesmente deixa de existir. Provado via dry-run (210 cenários).
CREATE OR REPLACE FUNCTION public.fn_dar_forbid_reopen()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  -- fix_version=20260626_m6 | ANTI-REGRESSAO: manter o bloqueio terminal->pending.
  IF NEW.status = 'pending' AND OLD.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'discount_approval_requests nao pode retornar para pending a partir de % (re-open proibido; crie nova solicitacao)', OLD.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_dar_forbid_reopen ON public.discount_approval_requests;
CREATE TRIGGER trg_dar_forbid_reopen
  BEFORE UPDATE ON public.discount_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_dar_forbid_reopen();

COMMENT ON FUNCTION public.fn_dar_forbid_reopen() IS
  'fix_version=20260626_m6: proibe terminal->pending (re-open). Para re-decidir crie nova solicitacao. Migration: forbid_dar_reopen_to_pending.';
