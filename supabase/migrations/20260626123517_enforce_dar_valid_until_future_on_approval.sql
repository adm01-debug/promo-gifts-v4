-- Melhoria M5: bloqueia aprovar com valid_until no passado, SOMENTE na transição -> approved.
-- Decisão de engenharia (provada via dry-run com ~110 cenários): NÃO usar CHECK persistente,
-- pois aprovações vencem naturalmente (fn_quotes_validate_discount já ignora valid_until <= now());
-- um CHECK persistente quebraria o vencimento natural de uma aprovação válida.
CREATE OR REPLACE FUNCTION public.fn_dar_check_valid_until_future()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  -- fix_version=20260626_m5 | ANTI-REGRESSAO: manter como trigger de TRANSICAO, jamais CHECK persistente.
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    IF NEW.valid_until IS NOT NULL AND NEW.valid_until::date < CURRENT_DATE THEN
      RAISE EXCEPTION 'valid_until nao pode estar no passado ao aprovar (recebido: %, hoje: %)', NEW.valid_until, CURRENT_DATE
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_dar_check_valid_until_future ON public.discount_approval_requests;
CREATE TRIGGER trg_dar_check_valid_until_future
  BEFORE UPDATE ON public.discount_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_dar_check_valid_until_future();

COMMENT ON FUNCTION public.fn_dar_check_valid_until_future() IS
  'fix_version=20260626_m5: bloqueia aprovacao com valid_until no passado SOMENTE na transicao -> approved. NUNCA converter para CHECK persistente (quebraria vencimento natural). Migration: enforce_dar_valid_until_future_on_approval.';
