-- Fix Function Search Paths for all public functions
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT n.nspname, p.proname, oidvectortypes(p.proargtypes) as arg_types
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
    ) LOOP
        EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public', r.nspname, r.proname, r.arg_types);
    END LOOP;
END $$;

-- Add RLS Policies for tables identified by linter
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_audit_log') THEN
        ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_log;
        CREATE POLICY "Admins can view audit logs" ON public.admin_audit_log 
        FOR SELECT TO authenticated 
        USING (auth.jwt()->>'role' IN ('admin', 'dev', 'supervisor'));
    END IF;
END $$;

DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'webhook_delivery_metrics') THEN
        ALTER TABLE public.webhook_delivery_metrics ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Admins can view webhook metrics" ON public.webhook_delivery_metrics;
        CREATE POLICY "Admins can view webhook metrics" ON public.webhook_delivery_metrics 
        FOR SELECT TO authenticated 
        USING (auth.jwt()->>'role' IN ('admin', 'dev', 'supervisor'));
    END IF;
END $$;

DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'app_vitals') THEN
        ALTER TABLE public.app_vitals ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Admins can view app vitals" ON public.app_vitals;
        CREATE POLICY "Admins can view app vitals" ON public.app_vitals 
        FOR SELECT TO authenticated 
        USING (auth.jwt()->>'role' IN ('admin', 'dev', 'supervisor'));
    END IF;
END $$;

DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auth_login_attempts') THEN
        ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Admins can view login attempts" ON public.auth_login_attempts;
        CREATE POLICY "Admins can view login attempts" ON public.auth_login_attempts 
        FOR SELECT TO authenticated 
        USING (auth.jwt()->>'role' IN ('admin', 'dev', 'supervisor'));
    END IF;
END $$;

DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversation_delivery_status') THEN
        ALTER TABLE public.conversation_delivery_status ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Admins can view delivery status" ON public.conversation_delivery_status;
        CREATE POLICY "Admins can view delivery status" ON public.conversation_delivery_status 
        FOR SELECT TO authenticated 
        USING (auth.jwt()->>'role' IN ('admin', 'dev', 'supervisor'));
    END IF;
END $$;

-- Grant access to service_role explicitly
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
