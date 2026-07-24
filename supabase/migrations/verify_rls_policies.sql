-- ============================================================================
-- VERIFICATION SCRIPT: RLS Policies Health Check
-- Run AFTER applying 20260712_fix_rls_policies_critical.sql
-- ============================================================================

-- Check 1: RLS is enabled on both tables
┌─ Query: Check RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('discount_approval_requests', 'workspace_notifications')
ORDER BY tablename;
-- Expected: rowsecurity = true for both

-- Check 2: Count policies
┌─ Query: Policy counts
SELECT
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('discount_approval_requests', 'workspace_notifications')
GROUP BY schemaname, tablename
ORDER BY tablename;
-- Expected: discount_approval_requests = 3, workspace_notifications >= 3

-- Check 3: List all policies with commands
┌─ Query: Detailed policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('discount_approval_requests', 'workspace_notifications')
ORDER BY tablename, policyname;

-- Check 4: Verify indexes exist
┌─ Query: Index status
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename IN ('discount_approval_requests', 'workspace_notifications')
ORDER BY tablename, indexname;

-- Check 5: Test RLS with sample query (as authenticated user)
┌─ Query: RLS filtering test (authenticated user)
SET ROLE authenticated;
SET app.current_user_id = 'USER_UUID_HERE';

SELECT COUNT(*) FROM public.workspace_notifications;
-- Expected: Only rows where user_id = auth.uid()

RESET ROLE;
RESET app.current_user_id;

-- Check 6: Performance baseline (sequential vs index scan)
┌─ Query: Query plan analysis
EXPLAIN ANALYZE
SELECT COUNT(*) 
FROM public.workspace_notifications
WHERE user_id = 'USER_UUID_HERE';
-- Expected: Index Scan (idx_workspace_notifications_user_id)
-- NOT: Seq Scan (which would be slow on 1M+ rows)
