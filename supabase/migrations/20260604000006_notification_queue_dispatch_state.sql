-- Migration: separate notification dispatch state from user read-state
-- Problem (cubic P1): process_notifications_queue() set is_read=true during
-- atomic claim, conflating queue processing state with user-facing read state.
-- Consequence: if dispatch failed after claim (e.g., push notification error,
-- edge function crash) the notification was silently lost — is_read=true
-- prevented re-queuing but the user never received the notification.
--
-- Fix: add dispatched_at column as the queue's ownership marker.
-- Queue predicate changes from is_read=false → dispatched_at IS NULL.
-- is_read remains user-only (set by UI when user dismisses the notification).

-- 1. Add dispatched_at to workspace_notifications
ALTER TABLE public.workspace_notifications
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;

-- 2. Backfill: rows already marked is_read=true were processed by the old
-- queue function; mark them as dispatched so they are not re-queued.
UPDATE public.workspace_notifications
SET dispatched_at = NOW()
WHERE is_read = true
  AND dispatched_at IS NULL;

-- 3. Efficient index for queue scans (only unprocessed rows)
CREATE INDEX IF NOT EXISTS idx_workspace_notifications_undispatched
  ON public.workspace_notifications (created_at ASC)
  WHERE dispatched_at IS NULL;

-- 4. Replace function: claim by dispatched_at IS NULL, set dispatched_at=NOW()
CREATE OR REPLACE FUNCTION public.process_notifications_queue(
  p_limit INT DEFAULT 500
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  message TEXT,
  type TEXT,
  category TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Atomically claim undispatched notifications.
  -- dispatched_at IS NULL = not yet sent by any queue worker.
  -- FOR UPDATE SKIP LOCKED ensures concurrent callers get disjoint batches.
  -- is_read is NOT touched here — it is updated by the UI when the user
  -- reads/dismisses the notification.
  RETURN QUERY
    WITH claimed AS (
      SELECT wn.id
      FROM public.workspace_notifications wn
      WHERE wn.dispatched_at IS NULL
      ORDER BY wn.created_at ASC
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.workspace_notifications wn
    SET dispatched_at = NOW()
    FROM claimed
    WHERE wn.id = claimed.id
    RETURNING wn.id, wn.user_id, wn.title, wn.message, wn.type, wn.category, wn.created_at;

  -- Purge old dispatched notifications.
  -- Only rows with dispatched_at IS NOT NULL are deleted, so undispatched
  -- notifications (e.g., for inactive users) are never silently discarded.
  DELETE FROM public.workspace_notifications
  WHERE dispatched_at IS NOT NULL
    AND created_at < NOW() - INTERVAL '90 days';

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

COMMENT ON FUNCTION public.process_notifications_queue IS
  'Retorna notificações não despachadas e as marca com dispatched_at=NOW() em '
  'transação única (FOR UPDATE SKIP LOCKED). dispatched_at rastreia o estado de '
  'processamento da fila; is_read permanece exclusivo para o usuário. '
  'Deve ser chamada apenas pela edge function process-queue via service_role.';

REVOKE EXECUTE ON FUNCTION public.process_notifications_queue FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_notifications_queue TO service_role;
