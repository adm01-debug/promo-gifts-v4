-- Migration: notification queue lease model for retry-safe delivery.
-- Problem (Codex P1): migration 000006 set dispatched_at=NOW() during the atomic
-- claim, before the edge function had confirmed successful delivery. If the edge
-- function crashes or times out after the claim, those rows have dispatched_at set
-- and are never re-queued, reproducing the notification-loss mode the previous
-- migration intended to fix.
--
-- Fix: introduce a two-phase claim/confirm pattern.
--   Phase 1 — claim: set dispatch_claim_expires_at = NOW() + 15 min (lease).
--             dispatched_at is NOT set here.
--   Phase 2 — confirm: edge function calls confirm_notifications_dispatched(ids)
--             after successful delivery; only then is dispatched_at set.
--   Recovery: if the edge function crashes, the lease expires after 15 minutes
--             and the notification becomes available for re-claim.
--
-- dispatched_at semantics are unchanged for external consumers:
--   NULL  = not yet confirmed delivered
--   NOT NULL = confirmed delivered (cleanup-eligible after 90 days)

ALTER TABLE public.workspace_notifications
  ADD COLUMN IF NOT EXISTS dispatch_claim_expires_at TIMESTAMPTZ;

-- idx_workspace_notifications_undispatched (created_at ASC, WHERE dispatched_at IS NULL)
-- was already created by migration 000006 — no duplicate index needed here.

-- Replace process_notifications_queue: set lease only (not dispatched_at).
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
  -- Atomically claim notifications that are:
  --   a) not yet confirmed delivered (dispatched_at IS NULL), AND
  --   b) either never claimed or whose claim lease has expired.
  -- Sets a 15-minute lease; does NOT set dispatched_at.
  -- dispatched_at is set only by confirm_notifications_dispatched() after delivery.
  RETURN QUERY
    WITH claimed AS (
      SELECT wn.id
      FROM public.workspace_notifications wn
      WHERE wn.dispatched_at IS NULL
        AND (
          wn.dispatch_claim_expires_at IS NULL
          OR wn.dispatch_claim_expires_at < NOW()
        )
      ORDER BY wn.created_at ASC
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.workspace_notifications wn
    SET dispatch_claim_expires_at = NOW() + INTERVAL '15 minutes'
    FROM claimed
    WHERE wn.id = claimed.id
    RETURNING wn.id, wn.user_id, wn.title, wn.message, wn.type, wn.category, wn.created_at;

  -- Purge confirmed-delivered notifications older than 90 days.
  -- Rows with dispatched_at IS NULL are never deleted here.
  -- Guard is_read = true so unread notifications (inactive users, etc.)
  -- are never silently discarded before the user has seen them.
  DELETE FROM public.workspace_notifications
  WHERE dispatched_at IS NOT NULL
    AND is_read = true
    AND created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- New function: called by the edge function after successful delivery to
-- permanently mark notifications as dispatched (clearing the lease).
CREATE OR REPLACE FUNCTION public.confirm_notifications_dispatched(
  p_ids UUID[]
)
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.workspace_notifications
  SET dispatched_at = NOW(),
      dispatch_claim_expires_at = NULL
  WHERE id = ANY(p_ids)
    AND dispatched_at IS NULL
    AND dispatch_claim_expires_at IS NOT NULL
    AND dispatch_claim_expires_at > NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

REVOKE EXECUTE ON FUNCTION public.process_notifications_queue FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_notifications_queue TO service_role;

REVOKE EXECUTE ON FUNCTION public.confirm_notifications_dispatched FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_notifications_dispatched TO service_role;

COMMENT ON FUNCTION public.process_notifications_queue IS
  'Claims undispatched notifications with a 15-minute lease (dispatch_claim_expires_at). '
  'Does NOT set dispatched_at — call confirm_notifications_dispatched() after delivery. '
  'Expired leases are automatically re-claimable, enabling at-least-once delivery.';

COMMENT ON FUNCTION public.confirm_notifications_dispatched IS
  'Marks notifications as permanently dispatched after successful delivery. '
  'Only confirms rows with an active (non-expired) lease to prevent accidentally '
  'dispatching unclaimed rows. Must be called by process-queue with IDs from '
  'process_notifications_queue(). Idempotent — already-confirmed rows are silently skipped.';
