-- 1. Infrastructure: system_kill_switches and rollout function
CREATE TABLE IF NOT EXISTS public.system_kill_switches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    switch_name TEXT UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT true,
    rollout_percentage INTEGER DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    legacy_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Deterministic rollout function
CREATE OR REPLACE FUNCTION public.fn_should_apply_kill_switch(p_switch_name TEXT, p_bucket_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rollout INTEGER;
    v_enabled BOOLEAN;
BEGIN
    SELECT enabled, rollout_percentage INTO v_enabled, v_rollout
    FROM public.system_kill_switches
    WHERE switch_name = p_switch_name;

    IF NOT FOUND OR v_enabled THEN
        RETURN FALSE; -- Switch is ACTIVE (not killed)
    END IF;

    -- If enabled = false, check rollout
    -- Deterministic bucket between 0-99
    RETURN (abs(hashtext(p_bucket_key)) % 100) < v_rollout;
END;
$$;

-- Seed default switches
INSERT INTO public.system_kill_switches (switch_name, enabled, rollout_percentage, legacy_message)
VALUES ('edge_external_db_bridge', false, 100, 'external-db-bridge foi descontinuada. Use REST nativo /rest/v1/.')
ON CONFLICT (switch_name) DO NOTHING;

-- 2. Security: Revoke public execute on SECURITY DEFINER functions
DO $$ 
DECLARE 
    func_record RECORD;
BEGIN 
    FOR func_record IN 
        SELECT n.nspname as schema_name, p.proname as function_name, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.prosecdef = true
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC', func_record.function_name, func_record.args);
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', func_record.function_name, func_record.args);
    END LOOP;
END $$;

-- 3. RLS Hardening
ALTER TABLE public.system_kill_switches ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.system_kill_switches TO authenticated;
GRANT ALL ON public.system_kill_switches TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'system_kill_switches' AND policyname = 'Public switches are readable by authenticated'
  ) THEN
    CREATE POLICY "Public switches are readable by authenticated" 
ON public.system_kill_switches 
FOR SELECT 
TO authenticated 
USING (true);
  END IF;
END $$;

DROP POLICY IF EXISTS "Authenticated can read freshness overrides" ON public.product_price_freshness_overrides;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_price_freshness_overrides' AND policyname = 'Authenticated can read freshness overrides'
  ) THEN
    CREATE POLICY "Authenticated can read freshness overrides" 
ON public.product_price_freshness_overrides 
FOR SELECT 
TO authenticated 
USING (true);
  END IF;
END $$;

DROP POLICY IF EXISTS "ownership_audit_reports_admin_select" ON public.ownership_audit_reports;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ownership_audit_reports' AND policyname = 'Admins/Devs can select audit reports'
  ) THEN
    CREATE POLICY "Admins/Devs can select audit reports" 
ON public.ownership_audit_reports 
FOR SELECT 
TO authenticated 
USING (is_admin(auth.uid()) OR is_dev(auth.uid()));
  END IF;
END $$;

-- Timestamp trigger for system_kill_switches
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_system_kill_switches_updated_at ON public.system_kill_switches;
CREATE TRIGGER tr_system_kill_switches_updated_at
BEFORE UPDATE ON public.system_kill_switches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
