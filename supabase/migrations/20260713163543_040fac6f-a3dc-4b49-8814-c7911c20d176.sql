-- Revoga EXECUTE de PUBLIC/anon/authenticated em 3 funções SECURITY DEFINER
-- que só devem ser chamadas via edge/cron (service_role). Fecha 7 findings
-- do gate check-security-definer-acl.

REVOKE EXECUTE ON FUNCTION public.claim_webhook_delivery(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_webhook_delivery(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_webhook_delivery_lock(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.release_webhook_delivery_lock(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_stale_webhook_locks() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cleanup_stale_webhook_locks() TO service_role;