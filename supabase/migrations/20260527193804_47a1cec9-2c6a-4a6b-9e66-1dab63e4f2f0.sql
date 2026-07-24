-- 1. Automate RLS policies for missing tables
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
        EXECUTE format('DROP POLICY IF EXISTS "Default system policy" ON public.%I', tbl_name);
        -- For audit/system tables, only admins. For others, we assume admin-only is the safest default if nothing was specified.
        EXECUTE format('CREATE POLICY "Default system policy" ON public.%I FOR SELECT TO authenticated USING (auth.jwt()->>''role'' IN (''admin'', ''dev'', ''supervisor''))', tbl_name);
    END LOOP;
END $$;

-- 2. Final Grant
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
-- We do NOT grant ALL to authenticated, only SELECT on what policies allow.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
