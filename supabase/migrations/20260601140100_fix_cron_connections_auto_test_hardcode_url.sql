-- O cron 'connections-auto-test' (a cada 15 min) usava current_setting('app.supabase_functions_base_url')
-- que era NULL (ALTER DATABASE SET não está disponível via MCP/pipeline — exige Dashboard).
-- url=NULL → NOT NULL violation em net.http_request_queue → ~4 falhas/hora → cron_health_1h FAIL.
--
-- Solução: recriar o job com URL hardcoded do projeto pqpdolkaeqlyzpdpbizo.
-- A chave anon é pública (frontend key, visível a todos os clientes).
-- Idempotente: unschedule é no-op se não existir; schedule recria.

SELECT cron.unschedule('connections-auto-test');

SELECT cron.schedule(
  'connections-auto-test',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pqpdolkaeqlyzpdpbizo.supabase.co/functions/v1/connections-auto-test',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvdWZzeHFsZmp5dXZ4dWV6cGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODY2NDMsImV4cCI6MjA4Mjk2MjY0M30.nm3WMOBSx5SUnIBmvF_Mj0Y-4hV6UohrBF0sUpuQvPc'
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);
