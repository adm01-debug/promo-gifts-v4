-- Audit and fix critical SECURITY DEFINER functions with correct signatures
ALTER FUNCTION public.get_unread_count() SET search_path = public;
ALTER FUNCTION public.acquire_ai_quota(uuid, text, text) SET search_path = public;
ALTER FUNCTION public.check_auth_throttling(text, text) SET search_path = public;
ALTER FUNCTION public.check_ip_access(text) SET search_path = public;
ALTER FUNCTION public.get_auto_test_job_status(integer) SET search_path = public;
ALTER FUNCTION public.claim_next_optimization() SET search_path = public;
ALTER FUNCTION public.complete_optimization(uuid, text, text, text, jsonb, text) SET search_path = public;
ALTER FUNCTION public.enqueue_optimization(text, text, text, integer) SET search_path = public;
ALTER FUNCTION public.generate_secure_token() SET search_path = public;
ALTER FUNCTION public.check_hardening_status() SET search_path = public;
ALTER FUNCTION public.audit_security_definer_acl() SET search_path = public;
