-- ============================================================================
-- SUPABASE RLS POLICIES FIX — Promo Gifts V4 [CRITICAL]
-- Database: doufsxqlfjyuvxuezpln
-- Severity: 🔴 CRITICAL — Security + Functionality
-- ============================================================================
-- Applied: 2026-07-12 PhD-level DB audit
-- Impact: Unblocks HEAD requests, secures user data isolation

-- FIX #1: discount_approval_requests — Missing RLS Policy
-- ────────────────────────────────────────────────────────
-- Before: No policy → 403 on HEAD (anon can't read), but authenticated can read ALL
-- After: User can only read own approvals

CREATE POLICY "enable_read_for_requesting_user"
  ON public.discount_approval_requests
  FOR SELECT
  TO authenticated
  USING (requesting_user_id = auth.uid());

CREATE POLICY "enable_insert_for_requesting_user"
  ON public.discount_approval_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (requesting_user_id = auth.uid());

CREATE POLICY "enable_update_for_requesting_user"
  ON public.discount_approval_requests
  FOR UPDATE
  TO authenticated
  USING (requesting_user_id = auth.uid())
  WITH CHECK (requesting_user_id = auth.uid());

-- FIX #2: workspace_notifications — User Scope Missing
-- ─────────────────────────────────────────────────────
-- Before: No policy OR too restrictive → 403 on HEAD
-- After: User can only read own notifications

CREATE POLICY "user_sees_own_notifications"
  ON public.workspace_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_can_insert_own_notifications"
  ON public.workspace_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_can_delete_own_notifications"
  ON public.workspace_notifications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- INDEXES for RLS filtering performance
-- ============================================================================
-- Critical for HEAD requests performance (O(1) instead of O(n) scan)

CREATE INDEX IF NOT EXISTS idx_discount_approval_requests_requesting_user_id
  ON public.discount_approval_requests(requesting_user_id DESC)
  WHERE requesting_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_notifications_user_id
  ON public.workspace_notifications(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_notifications_user_unread
  ON public.workspace_notifications(user_id)
  WHERE user_id IS NOT NULL AND is_read = false;

-- ============================================================================
-- ENABLE RLS (safety: use ALTER TABLE, never DISABLE without backup)
-- ============================================================================

ALTER TABLE public.discount_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Logging this migration for audit trail
-- ============================================================================
INSERT INTO public.migrations_log (name, applied_at, category, severity)
VALUES (
  '20260712_fix_rls_policies_critical',
  NOW(),
  'security/rls',
  'critical'
) ON CONFLICT DO NOTHING;
