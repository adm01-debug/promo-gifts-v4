-- Functions with no arguments
REVOKE EXECUTE ON FUNCTION public.audit_rls_matrix() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_collection_trash() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_external_connections_from_credentials() FROM public, anon, authenticated;

-- Functions with specific arguments
REVOKE EXECUTE ON FUNCTION public.cron_invoke_edge(text, jsonb, integer) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_platform_failure_metrics(integer) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_ownership_orphans(uuid, boolean, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_all_user_tokens(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_external_connections_from_credentials(text, text, uuid) FROM public, anon, authenticated;