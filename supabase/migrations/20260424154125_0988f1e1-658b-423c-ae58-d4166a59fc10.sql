-- Keep external-db-bridge warm: ping leve a cada 4 minutos
-- Evita cold start de 700ms+ por boot ocioso
DO $$
BEGIN
  -- Remove job antigo se existir (idempotente)
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'external-db-bridge-keepalive') THEN
    PERFORM cron.unschedule('external-db-bridge-keepalive');
  END IF;
END $$;

SELECT cron.schedule(
  'external-db-bridge-keepalive',
  '*/4 * * * *', -- a cada 4 minutos
  $$
  -- Runtime-only: host e chave vem de GUC/Vault, sem literals no migration.
  -- Requer:
  --   app.supabase_functions_base_url (ex.: https://<project-ref>.supabase.co)
  --   app.supabase_anon_key
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