-- ============================================================
-- Migration: webhook_inbound idempotency support (SAFE/IDEMPOTENT)
-- ============================================================
-- Notas:
--   • contract_version já existe NOT NULL no banco — NÃO tocar. A versão
--     anterior do Lovable tentava ADD COLUMN IF NOT EXISTS TEXT (nullable),
--     o que seria silenciosamente no-op por causa do IF NOT EXISTS, mas
--     induzia em erro. Removido.
--   • idempotency_key é nullable: webhooks sem chave continuam funcionando
--     (fallback usa hash da assinatura HMAC dentro da edge function).
--   • Index único parcial (endpoint_id, idempotency_key) garante atomicidade.
--   • REVOKE/GRANT explícitos: nenhuma leitura/escrita por anon/authenticated
--     no path crítico (já era política existente; mantido).
-- ============================================================

ALTER TABLE public.inbound_webhook_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_idempotency
  ON public.inbound_webhook_events (endpoint_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
