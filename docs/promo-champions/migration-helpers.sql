-- Helpers opcionais (rodar após migration.sql)

-- RPC para incrementar hit_count de forma atômica no dedupe
CREATE OR REPLACE FUNCTION public.increment_webhook_dedupe_hit(_correlation_key text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.webhook_inbound_dedupe
  SET hit_count = hit_count + 1
  WHERE correlation_key = _correlation_key;
$$;

REVOKE ALL ON FUNCTION public.increment_webhook_dedupe_hit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_webhook_dedupe_hit(text) TO service_role;

-- Cleanup TTL 30d (rodar via pg_cron 1x/dia)
--   SELECT cron.schedule('cleanup_webhook_inbound_dedupe', '0 3 * * *',
--     $$DELETE FROM public.webhook_inbound_dedupe WHERE first_seen_at < now() - interval '30 days'$$);
