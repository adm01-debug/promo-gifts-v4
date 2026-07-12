-- ============================================================================
-- PERFORMANCE INDEXES: Applied 2026-07-12 to doufsxqlfjyuvxuezpln
-- ============================================================================
-- Audit findings that motivated these indexes:
-- 1. idx_user_roles_user_id had 109,337 scans — every RLS check on
--    discount_approval_requests calls is_supervisor_or_above() which queries
--    user_roles WHERE user_id = X AND role IN ('dev','supervisor','admin','manager')
-- 2. workspace_notifications badge query (user_id + is_read=false) was using
--    a composite (user_id, created_at, is_read) — suboptimal for unread counts

-- INDEX 1: Partial composite on user_roles for faster RLS policy evaluation
-- Before: idx_user_roles_user_id (user_id only) → filter on role at heap level
-- After: idx_user_roles_user_id_role (user_id, role) WHERE elevated → index-only scan
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role
  ON public.user_roles(user_id, role)
  WHERE role IN ('dev', 'supervisor', 'admin', 'manager');

-- INDEX 2: Partial index for fast unread notification badge queries
-- Query: WHERE user_id = X AND is_read = false ORDER BY created_at DESC
-- Before: idx_workspace_notifications_user_unread (user_id, created_at, is_read)
-- After: partial index only covers unread rows → tiny, fast, exact
CREATE INDEX IF NOT EXISTS idx_workspace_notifications_user_unread_v2
  ON public.workspace_notifications(user_id, created_at DESC)
  WHERE is_read = false;

-- Run ANALYZE to update planner statistics
ANALYZE public.user_roles;
ANALYZE public.workspace_notifications;

-- ============================================================================
-- Verification
-- ============================================================================
-- SELECT i.relname, pg_size_pretty(pg_relation_size(i.oid)) FROM pg_class i
-- JOIN pg_index ix ON i.oid = ix.indexrelid
-- JOIN pg_class t ON t.oid = ix.indrelid
-- WHERE t.relname IN ('user_roles', 'workspace_notifications')
--   AND i.relname IN ('idx_user_roles_user_id_role', 'idx_workspace_notifications_user_unread_v2');
