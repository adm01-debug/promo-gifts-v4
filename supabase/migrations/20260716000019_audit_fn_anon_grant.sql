-- Migration: grant EXECUTE on audit_security_definer_acl to anon
--
-- Gate 5 CI (supabase-security-gate.yml) calls audit_security_definer_acl()
-- using VITE_SUPABASE_PUBLISHABLE_KEY (the anon JWT) as its service key.
-- Without this grant the RPC returns HTTP 401 and check-security-definer-audit.mjs
-- exits 1, failing the gate unconditionally.
--
-- The function exposes only pg_proc metadata (function names + problem labels),
-- not user data, so granting anon EXECUTE is safe for this read-only audit RPC.

GRANT EXECUTE ON FUNCTION public.audit_security_definer_acl() TO anon;
