REVOKE EXECUTE ON FUNCTION public.get_edge_function_secret(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_public_schema_signatures() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.maintain_webhook_metrics() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_expired_security_data() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_expired_step_up_artifacts(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.retry_failed_webhook_deliveries() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_external_connections_from_credentials() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_external_connections_from_credentials(text, text, uuid) FROM PUBLIC, anon, authenticated;