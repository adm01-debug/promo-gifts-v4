-- Segurança: Endurecer funções SECURITY DEFINER específicas
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- Garantir RLS na system_settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura pública de configurações básicas" ON public.system_settings;
CREATE POLICY "Permitir leitura pública de configurações básicas" 
ON public.system_settings FOR SELECT 
USING (key IN ('maintenance_mode', 'app_version', 'public_announcement'));

DROP POLICY IF EXISTS "Acesso total para administradores" ON public.system_settings;
CREATE POLICY "Acesso total para administradores" 
ON public.system_settings FOR ALL 
TO authenticated 
USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'dev', 'supervisor')
));

GRANT SELECT ON public.system_settings TO anon, authenticated;
GRANT ALL ON public.system_settings TO service_role;
