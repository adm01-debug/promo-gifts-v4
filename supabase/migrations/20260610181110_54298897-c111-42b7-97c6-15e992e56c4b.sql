-- 1. Ajustar segurança da função is_supervisor_or_above
ALTER FUNCTION public.is_supervisor_or_above(uuid) SECURITY DEFINER SET search_path = public;

-- 2. Garantir permissões de acesso
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;

-- 3. Índices de performance para login
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- 4. Função de verificação automática (Audit helper)
CREATE OR REPLACE FUNCTION public.check_auth_config_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'is_supervisor_sd', (SELECT prosecdef FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE proname = 'is_supervisor_or_above' AND nspname = 'public'),
        'profiles_grant', (SELECT has_table_privilege('authenticated', 'public.profiles', 'SELECT')),
        'user_roles_grant', (SELECT has_table_privilege('authenticated', 'public.user_roles', 'SELECT'))
    ) INTO result;
    RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_auth_config_status() TO authenticated;
