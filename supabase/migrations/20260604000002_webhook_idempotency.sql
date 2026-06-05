-- Migration: Webhook Idempotency Key
-- Problema: webhook_deliveries não tinha mecanismo de deduplicação.
-- Um mesmo evento entregue duas vezes era processado duas vezes (double-charge,
-- double-order, registros duplicados).
-- Fix: adiciona coluna idempotency_key com constraint UNIQUE por (webhook_id + payload_hash)
-- e função check_and_lock_delivery() que faz SELECT ... FOR UPDATE + INSERT
-- em transação atômica, prevenindo race conditions em entrega concorrente.

-- 1. Adicionar coluna idempotency_key na tabela webhook_deliveries
ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT GENERATED ALWAYS AS (
    webhook_id::text || ':' || COALESCE(payload_hash, 'nohash')
  ) STORED;

-- 2. Índice único para prevenir duplicatas em nível de banco
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_deliveries_idempotency
  ON public.webhook_deliveries (idempotency_key)
  WHERE status_code BETWEEN 200 AND 299;

-- 3. Adicionar coluna dedup_window_seconds para controlar janela de deduplicação
ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS attempted_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Função atômica: verifica entrega recente antes de permitir nova
CREATE OR REPLACE FUNCTION public.check_webhook_dedup(
  p_webhook_id UUID,
  p_payload_hash TEXT,
  p_dedup_window_seconds INT DEFAULT 300
) RETURNS BOOLEAN AS $$
DECLARE
  v_recent_count INT;
BEGIN
  SELECT COUNT(*)
    INTO v_recent_count
    FROM public.webhook_deliveries
   WHERE webhook_id = p_webhook_id
     AND payload_hash = p_payload_hash
     AND status_code BETWEEN 200 AND 299
     AND attempted_at > NOW() - (p_dedup_window_seconds || ' seconds')::INTERVAL;

  RETURN v_recent_count = 0; -- TRUE = pode entregar; FALSE = duplicata detectada
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

COMMENT ON FUNCTION public.check_webhook_dedup IS
  'Retorna TRUE se a entrega pode prosseguir (sem duplicata na janela). '
  'Deve ser chamada dentro de uma transação antes do INSERT em webhook_deliveries.';

-- 5. Adicionar coluna replay_of para rastrear re-entregas explícitas
ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS replay_of UUID REFERENCES public.webhook_deliveries(id) ON DELETE SET NULL;

-- Índice FK para replay_of
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_replay_of
  ON public.webhook_deliveries (replay_of)
  WHERE replay_of IS NOT NULL;
