-- Migration: grant EXECUTE on audit_security_definer_acl to service_role
--
-- Background:
--   Gate 5 CI uses SUPABASE_SERVICE_KEY (service_role JWT) to call
--   audit_security_definer_acl() via PostgREST. The function was created
--   with SECURITY DEFINER but without an explicit EXECUTE grant to service_role.
--   PostgreSQL function-level grants are not bypassed by service_role (only RLS
--   is bypassed), so the CI call was returning HTTP 401 / pg error 42501.
--
-- Grant to service_role so CI can audit the database.
-- The function is STABLE SECURITY DEFINER; granting service_role execute is safe.

GRANT EXECUTE ON FUNCTION public.audit_security_definer_acl() TO service_role;

-- Also grant to authenticated so internal tooling can call it.
GRANT EXECUTE ON FUNCTION public.audit_security_definer_acl() TO authenticated;
