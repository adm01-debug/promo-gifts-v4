-- =====================================================
-- Cron Jobs Configuration
-- =====================================================
-- Requer extensão pg_cron no Supabase

-- Ativar pg_cron (executar como superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =====================================================
-- JOB 1: Processar Queue (a cada minuto)
-- =====================================================
SELECT cron.schedule(
  'process-notification-queue',
  '* * * * *', -- Todo minuto
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/process-queue',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- =====================================================
-- JOB 2: Enviar Digest (a cada hora no minuto 0)
-- =====================================================
SELECT cron.schedule(
  'send-daily-digest',
  '0 * * * *', -- Todo hora no minuto 0
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-digest',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- =====================================================
-- JOB 3: Cleanup (domingo às 3h)
-- =====================================================
SELECT cron.schedule(
  'cleanup-old-notifications',
  '0 3 * * 0', -- Domingo às 3h
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/cleanup-notifications',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- =====================================================
-- JOB 4: Purge favorite trash (daily at 04:00 UTC)
-- =====================================================
-- Removes items from favorite_items_trash that have been there
-- for more than 30 days (TTL enforced by purge_favorite_trash_old).
-- Runs as the postgres role which has EXECUTE on the function.
SELECT cron.schedule(
  'purge-favorite-trash',
  '0 4 * * *', -- Todo dia às 04:00 UTC
  $$
  SELECT public.purge_favorite_trash_old();
  $$
);

-- =====================================================
-- Visualizar jobs agendados
-- =====================================================
-- SELECT * FROM cron.job;

-- =====================================================
-- Remover job (se necessário)
-- =====================================================
-- SELECT cron.unschedule('process-notification-queue');
-- SELECT cron.unschedule('send-daily-digest');
-- SELECT cron.unschedule('cleanup-old-notifications');
-- SELECT cron.unschedule('purge-favorite-trash');
