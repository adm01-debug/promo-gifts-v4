-- Hardening user_preferences (was identified as potential risk)
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own preferences" ON public.user_preferences;
CREATE POLICY "Users can manage their own preferences" 
ON public.user_preferences 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Hardening quote_history (ensuring audit logs are secure)
ALTER TABLE public.quote_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sellers can view history of their quotes" ON public.quote_history;
CREATE POLICY "Sellers can view history of their quotes" 
ON public.quote_history 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.quotes 
    WHERE public.quotes.id = quote_history.quote_id 
    AND public.quotes.seller_id = auth.uid()
  )
);

-- Securing system_settings (admin-only writes)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can view settings" ON public.system_settings;
CREATE POLICY "Everyone can view settings" ON public.system_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can update settings" ON public.system_settings;
CREATE POLICY "Admins can update settings" ON public.system_settings FOR UPDATE TO authenticated 
USING (auth.jwt() ->> 'role' = 'admin');

-- Granting explicit access to ensure API functionality
GRANT SELECT ON public.system_settings TO authenticated;
GRANT ALL ON public.user_preferences TO authenticated;
GRANT SELECT ON public.quote_history TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
