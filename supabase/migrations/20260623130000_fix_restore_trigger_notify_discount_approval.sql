-- =============================================================================
-- FIX: Restaurar trigger trg_notify_discount_approval em discount_approval_requests
-- =============================================================================
-- BUG: A migration 20260414232158_6a8d4128 removeu o trigger sem recriar.
-- IMPACTO: Quando vendedor solicita desconto acima do limite, admins NAO
-- recebem workspace_notification de alerta. Quando admin aprova/rejeita,
-- vendedor NAO recebe workspace_notification de retorno.
-- CONFIRMADO por Joaquim: todo mundo deve receber notificacao automatica.
-- DESCOBERTO: auditoria adversarial 2026-06-23.
--
-- Fluxo do trigger:
--   INSERT + status='pending' -> notifica TODOS os admins (role='admin')
--   UPDATE pending->approved  -> notifica vendedor: desconto aprovado
--   UPDATE pending->rejected  -> notifica vendedor: desconto recusado + motivo
--
-- A funcao notify_discount_approval_request() ja estava:
--   - SECURITY DEFINER
--   - SET search_path = public
--   - Corretamente implementada
-- =============================================================================

DROP TRIGGER IF EXISTS trg_notify_discount_approval ON public.discount_approval_requests;

CREATE TRIGGER trg_notify_discount_approval
  AFTER INSERT OR UPDATE ON public.discount_approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_discount_approval_request();
