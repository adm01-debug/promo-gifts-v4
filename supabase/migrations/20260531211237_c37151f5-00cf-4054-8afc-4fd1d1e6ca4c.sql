-- 1. Fix Permissive RLS on products
DROP POLICY IF EXISTS "Allow initial sync insert" ON public.products;

-- 2. Hardening Functions: Set search_path = public for all functions in the public schema
-- This prevents search path hijacking and resolves 300+ linter warnings.
DO $$ 
DECLARE 
    func_record RECORD;
BEGIN 
    FOR func_record IN 
        SELECT 
            n.nspname as schema_name, 
            p.proname as function_name, 
            pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON n.oid = p.pronamespace 
        WHERE n.nspname = 'public'
    LOOP 
        EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public', 
            func_record.schema_name, 
            func_record.function_name, 
            func_record.args);
    END LOOP; 
END $$;

-- 3. Access Control: Revoke public execution and grant to specific roles
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 4. Fix specific table policies identified as overly permissive
DROP POLICY IF EXISTS "Anyone can insert telemetry" ON public.frontend_telemetry;
CREATE POLICY "Authenticated users can insert telemetry" 
ON public.frontend_telemetry 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

GRANT ALL ON public.frontend_telemetry TO service_role;

-- 5. Ensure standard grants for all tables in public schema
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
