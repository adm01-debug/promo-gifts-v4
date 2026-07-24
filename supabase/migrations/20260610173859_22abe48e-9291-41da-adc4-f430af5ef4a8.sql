-- Fix simulation_logs policy (was ALL for public with true/true)
DROP POLICY IF EXISTS "Service role manages simulation logs" ON public.simulation_logs;
CREATE POLICY "Service role manages simulation logs" ON public.simulation_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Ensure authenticated users can only insert their own logs if needed, 
-- or keep it restricted to service_role/admins.
-- Adding a policy for admins to view all logs if they don't already have one.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all simulation logs') THEN
        CREATE POLICY "Admins can view all simulation logs" ON public.simulation_logs
          FOR SELECT TO authenticated USING (is_admin(auth.uid()));
    END IF;
END $$;

-- Fix SECURITY DEFINER views by dropping and recreating with SECURITY INVOKER
DROP VIEW IF EXISTS public.v_products_public;
CREATE VIEW public.v_products_public WITH (security_invoker = true) AS 
SELECT * FROM public.products WHERE is_active = true;

DROP VIEW IF EXISTS public.v_suppliers_public;
CREATE VIEW public.v_suppliers_public WITH (security_invoker = true) AS 
SELECT * FROM public.suppliers WHERE active = true;

-- Fix functions search_path for security
ALTER FUNCTION public.is_admin(user_id uuid) SET search_path = public;
ALTER FUNCTION public.is_dev(user_id uuid) SET search_path = public;
ALTER FUNCTION public.has_role(user_id uuid, requested_role app_role) SET search_path = public;

-- Optimize simulation_logs for high volume inserts
CREATE INDEX IF NOT EXISTS idx_simulation_logs_created_at ON public.simulation_logs (created_at DESC);
