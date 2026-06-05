-- Migration: atomic webhook delivery claim to eliminate dedup race condition.
--
-- Root cause (Codex P1): check_webhook_dedup acquires pg_advisory_xact_lock but
-- the lock is transaction-scoped — it is released when the RPC call returns,
-- before the edge function inserts a delivery row. Two concurrent dispatcher
-- invocations for the same webhook+payload can both pass the check before either
-- writes a row, causing both to POST externally (double-charge, double-order).
--
-- Fix: introduce a webhook_delivery_locks table with a PRIMARY KEY on
-- (webhook_id, payload_hash). claim_webhook_delivery() does an atomic
-- INSERT ... ON CONFLICT DO NOTHING — the unique constraint guarantees only
-- one concurrent invocation can insert the lock row; the other gets 0 rows and
-- returns FALSE. release_webhook_delivery_lock() removes the lock after the
-- full retry cycle so future retries are not blocked by a stale lock.
--
-- Crash recovery: if the edge function crashes before calling release, the lock
-- row has a claimed_at timestamp; claim_webhook_delivery() deletes any lock
-- older than 15 minutes, after which the delivery is eligible to be retried.

CREATE TABLE IF NOT EXISTS public.webhook_delivery_locks (
  webhook_id    UUID         NOT NULL REFERENCES public.outbound_webhooks(id) ON DELETE CASCADE,
  payload_hash  TEXT         NOT NULL,
  claimed_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (webhook_id, payload_hash)
);

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_locks_claimed_at
  ON public.webhook_delivery_locks (claimed_at);

-- claim_webhook_delivery: atomically checks for a recent successful delivery or
-- an in-flight lock, then inserts the lock row. Returns TRUE when the caller
-- should proceed with delivery, FALSE when it should skip.
CREATE OR REPLACE FUNCTION public.claim_webhook_delivery(
  p_webhook_id           UUID,
  p_payload_hash         TEXT,
  p_dedup_window_seconds INT DEFAULT 300
) RETURNS BOOLEAN AS $$
DECLARE
  v_recent_count INT;
  v_rows_inserted INT;
BEGIN
  IF p_payload_hash IS NULL THEN
    RETURN TRUE; -- no hash → no dedup, always allow
  END IF;

  -- Expire stale locks (handles edge-function crashes before release was called).
  DELETE FROM public.webhook_delivery_locks
  WHERE webhook_id    = p_webhook_id
    AND payload_hash  = p_payload_hash
    AND claimed_at    < NOW() - INTERVAL '15 minutes';

  -- Check for a recent successful delivery within the dedup window.
  SELECT COUNT(*)
    INTO v_recent_count
    FROM public.webhook_deliveries
   WHERE webhook_id   = p_webhook_id
     AND payload_hash = p_payload_hash
     AND status_code  BETWEEN 200 AND 299
     AND attempted_at > NOW() - (p_dedup_window_seconds || ' seconds')::INTERVAL;

  IF v_recent_count > 0 THEN
    RETURN FALSE; -- duplicate: recent successful delivery exists
  END IF;

  -- Atomically acquire the delivery lock.
  -- ON CONFLICT DO NOTHING means a concurrent claim for the same key yields 0
  -- inserted rows (ROW_COUNT = 0) without error — the caller skips delivery.
  INSERT INTO public.webhook_delivery_locks (webhook_id, payload_hash)
  VALUES (p_webhook_id, p_payload_hash)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
  RETURN v_rows_inserted > 0; -- TRUE = lock acquired; FALSE = already claimed
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- release_webhook_delivery_lock: called after the full delivery retry cycle
-- (success or final failure) so that future retries are not blocked by the lock.
-- Idempotent — safe to call even if the lock was already expired and deleted.
CREATE OR REPLACE FUNCTION public.release_webhook_delivery_lock(
  p_webhook_id  UUID,
  p_payload_hash TEXT
) RETURNS VOID AS $$
BEGIN
  DELETE FROM public.webhook_delivery_locks
  WHERE webhook_id   = p_webhook_id
    AND payload_hash = p_payload_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

REVOKE EXECUTE ON FUNCTION public.claim_webhook_delivery FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.claim_webhook_delivery TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_webhook_delivery_lock FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.release_webhook_delivery_lock TO service_role;

COMMENT ON TABLE public.webhook_delivery_locks IS
  'In-flight delivery claim table. A row exists for the duration of a single '
  'delivery attempt cycle (all retries). Rows older than 15 minutes are '
  'automatically expired by claim_webhook_delivery() to handle edge-function '
  'crashes that skip the release call.';

COMMENT ON FUNCTION public.claim_webhook_delivery IS
  'Atomic check-and-claim for webhook deduplication. Deletes stale locks, checks '
  'for recent successful deliveries, then inserts a lock row via INSERT ... ON '
  'CONFLICT DO NOTHING. Returns TRUE if the lock was acquired (proceed), FALSE if '
  'a duplicate or in-flight claim was detected (skip). Must be paired with '
  'release_webhook_delivery_lock() after the delivery attempt cycle.';

COMMENT ON FUNCTION public.release_webhook_delivery_lock IS
  'Releases a delivery lock after the full retry cycle. Idempotent. Must be called '
  'after claim_webhook_delivery() returns TRUE, regardless of delivery outcome, so '
  'that failed deliveries can be retried by subsequent dispatcher invocations.';
