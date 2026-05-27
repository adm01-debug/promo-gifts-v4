-- 1. Fix ai_usage_logs visibility
DROP POLICY IF EXISTS "Authenticated users can view own usage" ON public.ai_usage_logs;
CREATE POLICY "Authenticated users can view own usage" 
ON public.ai_usage_logs 
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

-- 2. Revoke broad function grants accidentally reapplied
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 3. Specifically lock down dangerous test/internal functions using safe blocks
DO $$ 
BEGIN
    BEGIN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.seed_discount_test_users() FROM authenticated, anon';
    EXCEPTION WHEN undefined_function THEN NULL;
    END;

    BEGIN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.cleanup_discount_test_data() FROM authenticated, anon';
    EXCEPTION WHEN undefined_function THEN NULL;
    END;

    BEGIN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.fn_run_and_persist_smoke_tests() FROM authenticated, anon';
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
END $$;

-- 4. Secure path for core functions
DO $$ 
BEGIN
    BEGIN
        ALTER FUNCTION public.is_admin() SET search_path = '';
    EXCEPTION WHEN undefined_function THEN NULL;
    END;

    BEGIN
        ALTER FUNCTION public.is_manager_or_admin() SET search_path = '';
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
END $$;
