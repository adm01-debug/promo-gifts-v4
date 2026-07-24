-- Create notification preferences table
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- e.g., 'security', 'system', 'marketing'
    in_app_enabled BOOLEAN NOT NULL DEFAULT true,
    push_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, category)
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notification_preferences TO authenticated;
GRANT ALL ON public.user_notification_preferences TO service_role;

-- Enable RLS
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own notification preferences" 
ON public.user_notification_preferences 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Update trigger for user_notification_preferences
CREATE TRIGGER update_user_notification_preferences_updated_at
BEFORE UPDATE ON public.user_notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes to workspace_notifications for search and filtering
CREATE INDEX IF NOT EXISTS idx_workspace_notifications_category ON public.workspace_notifications(category);
CREATE INDEX IF NOT EXISTS idx_workspace_notifications_search ON public.workspace_notifications USING gin(to_tsvector('portuguese', title || ' ' || message));
