-- Final repair for admin_audit_log to match strict test requirements

-- 3. ADMIN_AUDIT_LOG
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

-- Drop ALL possible existing policies to avoid name conflicts and ensure clean state
DROP POLICY IF EXISTS "admin_audit_log_insert_self" ON public.admin_audit_log;
DROP POLICY IF EXISTS "admin_audit_log_read_scoped" ON public.admin_audit_log;
DROP POLICY IF EXISTS "admin_audit_log_select_self" ON public.admin_audit_log;
DROP POLICY IF EXISTS "admin_audit_log_read_v2" ON public.admin_audit_log;
DROP POLICY IF EXISTS "admin_audit_log_insert_v2" ON public.admin_audit_log;
DROP POLICY IF EXISTS "admin_audit_log_read_v3" ON public.admin_audit_log;
DROP POLICY IF EXISTS "admin_audit_log_insert_v3" ON public.admin_audit_log;

-- Create strict admin-only policies as required by tests
CREATE POLICY "admin_audit_log_read_admin_v4" 
ON public.admin_audit_log FOR SELECT 
TO authenticated 
USING (
  is_admin_strict(auth.uid()) OR 
  is_dev(auth.uid())
);

CREATE POLICY "admin_audit_log_insert_admin_v4" 
ON public.admin_audit_log FOR INSERT 
TO authenticated 
WITH CHECK (
  is_admin_strict(auth.uid()) OR 
  is_dev(auth.uid())
);

-- Ensure RLS is active
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
