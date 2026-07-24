-- Ajustes na tabela workspace_notifications
ALTER TABLE public.workspace_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON public.workspace_notifications;
CREATE POLICY "Users can read own notifications"
ON public.workspace_notifications FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.workspace_notifications;
CREATE POLICY "Users can update own notifications"
ON public.workspace_notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.workspace_notifications;
CREATE POLICY "Users can delete own notifications"
ON public.workspace_notifications FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert notifications" ON public.workspace_notifications;
CREATE POLICY "Users can insert notifications for themselves"
ON public.workspace_notifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.workspace_notifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_notifications TO authenticated;

-- Ajustes na tabela user_notification_preferences
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own notification preferences" ON public.user_notification_preferences;
CREATE POLICY "Users can manage their own notification preferences"
ON public.user_notification_preferences FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.user_notification_preferences TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notification_preferences TO authenticated;
