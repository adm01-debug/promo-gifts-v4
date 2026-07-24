-- Fix Function Search Path Mutable (Linter 0011)
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.prosecdef = true
    LOOP
        EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public', 
                       func_record.nspname, func_record.proname, func_record.args);
    END LOOP;
END $$;

-- Fix Public Can Execute SECURITY DEFINER Function (Linter 0028)
-- Overloaded functions require specifying the argument list.

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_strict(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_all_sales(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_quotes(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_all_user_tokens(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_seller_only(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_audit_logs(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_manager_or_admin() FROM public, anon;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_strict(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_all_sales(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_quotes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_all_user_tokens(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_seller_only(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_audit_logs(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated;

-- Hardening RLS
ALTER TABLE IF EXISTS public.admin_audit_log_y2026m02 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_audit_log_y2026m06 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.frontend_telemetry ENABLE ROW LEVEL SECURITY;

-- Guards: partitions admin_audit_log_y2026m* podem não existir em preview snapshots
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='admin_audit_log_y2026m02') THEN
    GRANT ALL ON public.admin_audit_log_y2026m02 TO service_role;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='admin_audit_log_y2026m06') THEN
    GRANT ALL ON public.admin_audit_log_y2026m06 TO service_role;
  END IF;
END $$;
GRANT ALL ON public.frontend_telemetry TO service_role;
GRANT ALL ON public.password_reset_requests TO service_role;

DROP POLICY IF EXISTS "Anyone can request a password reset" ON public.password_reset_requests;
CREATE POLICY "Anyone can request a password reset" 
ON public.password_reset_requests 
FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can only see their own requests" ON public.password_reset_requests;
CREATE POLICY "Users can only see their own requests" 
ON public.password_reset_requests 
FOR SELECT 
USING (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Anyone can insert telemetry" ON public.frontend_telemetry;
CREATE POLICY "Anyone can insert telemetry" 
ON public.frontend_telemetry 
FOR INSERT 
WITH CHECK (true);

-- Ensure we don't drop a policy if it doesn't exist yet, but create it if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read telemetry' AND tablename = 'frontend_telemetry') THEN
        CREATE POLICY "Admins can read telemetry" 
        ON public.frontend_telemetry 
        FOR SELECT 
        USING (is_admin(auth.uid()));
    END IF;
END $$;
