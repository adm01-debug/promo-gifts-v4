-- Hardening: remove literal apikey/project URL from cron commands and tighten secret-source ACLs.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'external-db-bridge-keepalive') THEN
    PERFORM cron.unschedule('external-db-bridge-keepalive');
  END IF;
END $$;

SELECT cron.schedule(
  'external-db-bridge-keepalive',
  '*/4 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_functions_base_url', true) || '/functions/v1/external-db-bridge',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', current_setting('app.supabase_anon_key', true)
    ),
    body := '{"operation":"ping"}'::jsonb,
    timeout_milliseconds := 5000
  ) AS request_id;
  $$
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'connections-auto-test') THEN
    PERFORM cron.unschedule('connections-auto-test');
  END IF;
END $$;

SELECT cron.schedule(
  'connections-auto-test',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_functions_base_url', true) || '/functions/v1/connections-auto-test',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', current_setting('app.supabase_anon_key', true)
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

-- Secret-source ACL hardening: only postgres/service_role should read decrypted secrets directly.
REVOKE ALL ON SCHEMA vault FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA vault TO postgres, service_role;

REVOKE ALL ON TABLE vault.decrypted_secrets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE vault.decrypted_secrets TO postgres, service_role;

REVOKE ALL ON TABLE vault.secrets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE vault.secrets TO postgres, service_role;

-- Keep helper function backend-only too.
DO $$
BEGIN
  IF to_regprocedure('public.get_edge_function_secret(text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.get_edge_function_secret(text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.get_edge_function_secret(text) TO postgres, service_role;
  END IF;
END $$;
