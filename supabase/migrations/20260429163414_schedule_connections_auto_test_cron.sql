-- ============================================================================
-- Schedule the `connections-auto-test` cron job
-- ----------------------------------------------------------------------------
-- A migration anterior (20260423184705) criou as helpers
-- public.get_connections_auto_test_interval() / set_connections_auto_test_interval()
-- assumindo que o cron job `connections-auto-test` já existia. Mas nenhuma
-- migration criava de fato esse job — então o auto-test nunca rodava em
-- produção e o card AutoTestJobStatus ficava sempre "untested".
--
-- Esta migration cria o job idempotentemente apontando para a edge function
-- /functions/v1/connections-auto-test, com schedule default a cada 15 min
-- (valor permitido pela helper set_connections_auto_test_interval).
-- ============================================================================

DO $$
BEGIN
  -- Idempotente: remove versão antiga se existir antes de re-agendar
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'connections-auto-test') THEN
    PERFORM cron.unschedule('connections-auto-test');
  END IF;
END $$;

SELECT cron.schedule(
  'connections-auto-test',
  '*/15 * * * *', -- a cada 15 minutos (valor permitido pela helper de intervalo)
  $$
  -- Runtime-only: host e chave vêm de configuração segura em runtime.
  -- Requer:
  --   app.supabase_functions_base_url (ex.: https://<project-ref>.supabase.co)
  --   app.supabase_anon_key
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

-- Sanity check: helper deve agora retornar 15 (não NULL)
DO $$
DECLARE
  configured_minutes integer;
BEGIN
  SELECT public.get_connections_auto_test_interval() INTO configured_minutes;
  IF configured_minutes IS DISTINCT FROM 15 THEN
    RAISE WARNING 'connections-auto-test scheduled but interval helper returned %, expected 15',
      configured_minutes;
  END IF;
END $$;
