-- FIX: Supabase RLS policies blocking HEAD requests
-- Some policies may not account for HEAD method; this ensures
-- HEAD requests are treated same as GET for cache checking.

-- Note: This SQL is for reference/documentation.
-- Actual RLS fixes should be applied via Supabase dashboard → Authentication → Policies

-- For discount_approval_requests table:
-- Ensure the RLS policy allows authenticated users to check existence:
-- CREATE POLICY "allow_authenticated_head_check"
--   ON public.discount_approval_requests
--   FOR SELECT
--   TO authenticated
--   USING (true);

-- For workspace_notifications table:
-- Ensure users can check their own unread notifications:
-- CREATE POLICY "allow_user_notification_check"
--   ON public.workspace_notifications
--   FOR SELECT
--   TO authenticated
--   USING (user_id = auth.uid());
