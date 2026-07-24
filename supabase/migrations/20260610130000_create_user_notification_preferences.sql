-- Preferências de notificação por usuário/categoria.
-- Referenciada por src/services/notificationPreferenceService.ts.
-- A tabela nunca existiu no banco vivo → a feature falhava silenciosamente.
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  in_app_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_notification_preferences_user_category_key UNIQUE (user_id, category)
);
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY unp_select_own_or_admin ON public.user_notification_preferences
  FOR SELECT USING (((SELECT auth.uid()) = user_id) OR is_admin_or_above((SELECT auth.uid())));
CREATE POLICY unp_insert_self ON public.user_notification_preferences
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY unp_update_own_or_admin ON public.user_notification_preferences
  FOR UPDATE USING (((SELECT auth.uid()) = user_id) OR is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (((SELECT auth.uid()) = user_id) OR is_admin_or_above((SELECT auth.uid())));
CREATE POLICY unp_delete_own_or_admin ON public.user_notification_preferences
  FOR DELETE USING (((SELECT auth.uid()) = user_id) OR is_admin_or_above((SELECT auth.uid())));
CREATE INDEX IF NOT EXISTS idx_unp_user_id ON public.user_notification_preferences(user_id);

-- Mantém updated_at coerente em UPDATEs (padrão do repo). O service também envia
-- updated_at no upsert, mas o trigger garante a invariante mesmo p/ outros writers.
DROP TRIGGER IF EXISTS trg_unp_updated_at ON public.user_notification_preferences;
CREATE TRIGGER trg_unp_updated_at
  BEFORE UPDATE ON public.user_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
