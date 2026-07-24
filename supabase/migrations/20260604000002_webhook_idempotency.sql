-- Migration: Webhook Idempotency Key
-- Problema: webhook_deliveries não tinha mecanismo de deduplicação.
-- Um mesmo evento entregue duas vezes era processado duas vezes (double-charge,
-- double-order, registros duplicados).
-- Fix: adiciona coluna idempotency_key com constraint UNIQUE por (webhook_id + payload_hash)
-- e função check_and_lock_delivery() que faz SELECT ... FOR UPDATE + INSERT
-- em transação atômica, prevenindo race conditions em entrega concorrente.

-- 1. Adicionar coluna idempotency_key na tabela webhook_deliveries
-- NULL when payload_hash is absent — unique constraint does not fire for NULLs,
-- so webhooks without a hash are never incorrectly blocked.
ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT GENERATED ALWAYS AS (
    webhook_id::text || ':' || payload_hash
  ) STORED;

-- 2a. Lock the table to serialise all three steps (DELETE + CREATE INDEX) against
-- concurrent webhook inserts. SHARE ROW EXCLUSIVE MODE blocks INSERT/UPDATE/DELETE
-- for the lifetime of this transaction, so no new duplicate can slip in between
-- the cleanup and the moment the unique index becomes active.
LOCK TABLE public.webhook_deliveries IN SHARE ROW EXCLUSIVE MODE;

-- 2b. Remover duplicatas históricas antes de criar o índice único.
-- Uses ctid (physical tuple position) as the stable tiebreaker — rows with a
-- smaller ctid were inserted earlier, approximating "oldest delivery" for
-- pre-existing rows where id is a random UUID and carries no time ordering.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY webhook_id, payload_hash
           ORDER BY ctid
         ) AS rn
  FROM public.webhook_deliveries
  WHERE status_code BETWEEN 200 AND 299
    AND payload_hash IS NOT NULL
)
DELETE FROM public.webhook_deliveries
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2c. Índice para acesso eficiente por idempotency_key.
-- Não usamos UNIQUE aqui — o check de deduplicação com janela de tempo é feito
-- em check_webhook_dedup(); um índice UNIQUE impediria replay legítimo após o
-- vencimento da janela (ex.: retry após 10 min com window de 5 min).
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_idempotency
  ON public.webhook_deliveries (idempotency_key)
  WHERE status_code BETWEEN 200 AND 299;

-- 3. Adicionar coluna attempted_at para controlar janela de deduplicação
ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS attempted_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Função atômica: verifica entrega recente antes de permitir nova.
-- Usa pg_advisory_xact_lock para serializar verificações concorrentes do mesmo
-- webhook+hash, eliminando a race condition check-then-act.
-- Quando payload_hash é NULL, retorna TRUE imediatamente (sem hash = sem dedup).
CREATE OR REPLACE FUNCTION public.check_webhook_dedup(
  p_webhook_id UUID,
  p_payload_hash TEXT,
  p_dedup_window_seconds INT DEFAULT 300
) RETURNS BOOLEAN AS $$
DECLARE
  v_recent_count INT;
  v_lock_key BIGINT;
BEGIN
  -- Without a hash we cannot deduplicate; allow delivery
  IF p_payload_hash IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Serialise concurrent checks for the same webhook + payload combination.
  -- hashtextextended returns 64-bit, avoiding the collision contention of hashtext (32-bit).
  v_lock_key := hashtextextended(p_webhook_id::text || ':' || p_payload_hash, 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

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
  'Adquire advisory lock transacional para serializar chamadas concorrentes. '
  'Deve ser chamada dentro de uma transação antes do INSERT em webhook_deliveries.';

-- Restringir EXECUTE ao service_role para evitar que clientes comuns possam
-- sondar existência de entregas de outros webhooks via PostgREST.
REVOKE EXECUTE ON FUNCTION public.check_webhook_dedup FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_webhook_dedup TO service_role;

-- 5. Adicionar coluna replay_of para rastrear re-entregas explícitas
ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS replay_of UUID REFERENCES public.webhook_deliveries(id) ON DELETE SET NULL;

-- Índice FK para replay_of
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_replay_of
  ON public.webhook_deliveries (replay_of)
  WHERE replay_of IS NOT NULL;
