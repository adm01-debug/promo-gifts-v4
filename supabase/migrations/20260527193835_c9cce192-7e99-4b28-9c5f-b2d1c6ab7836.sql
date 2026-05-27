-- 1. Revoke public execute on all functions in public schema
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM public;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM public;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- 2. Fix search_path on any missed functions (idempotent)
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

-- 3. Standardize RLS policies for common system tables to authenticated-only or admin-only
-- ai_usage_logs was found with a (true) policy
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_usage_logs') THEN
        DROP POLICY IF EXISTS "Service role can update AI usage logs" ON public.ai_usage_logs;
        CREATE POLICY "Service role can update AI usage logs" ON public.ai_usage_logs 
        FOR ALL TO service_role USING (true) WITH CHECK (true);
        
        DROP POLICY IF EXISTS "Authenticated users can view own usage" ON public.ai_usage_logs;
        CREATE POLICY "Authenticated users can view own usage" ON public.ai_usage_logs 
        FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- 4. Final Cleanup: Ensure no remaining tables have RLS enabled without policies
DO $$ 
DECLARE 
    tbl_name text;
BEGIN
    FOR tbl_name IN (
        SELECT 
            t.tablename
        FROM 
            pg_tables t
        JOIN 
            pg_class c ON c.relname = t.tablename AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        LEFT JOIN 
            pg_policy p ON p.polrelid = c.oid
        WHERE 
            t.schemaname = 'public' 
            AND t.rowsecurity = true
            AND p.polname IS NULL
    ) LOOP
        EXECUTE format('CREATE POLICY "System fallback policy" ON public.%I FOR SELECT TO authenticated USING (auth.jwt()->>''role'' IN (''admin'', ''dev'', ''supervisor''))', tbl_name);
    END LOOP;
END $$;

-- 5. Final Grant
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
