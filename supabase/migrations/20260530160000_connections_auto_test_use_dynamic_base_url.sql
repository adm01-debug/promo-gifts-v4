-- ============================================================================
-- Reaponta o cron "connections-auto-test" para o resolvedor dinamico de base URL
-- ----------------------------------------------------------------------------
-- Contexto (CORRECAO-04):
--   O job vivo em producao (jobid 36) ainda usava o corpo LEGADO:
--     url     := current_setting('app.supabase_functions_base_url', true) || ...
--     headers := jsonb_build_object('apikey', current_setting('app.supabase_anon_key', true))
--   Ambos os GUCs eram NULL -> a cada 15 min falhava com
--     "null value in column url of relation http_request_queue"
--   (96 falhas / 24h, 0 sucessos). Alem disso o header estava errado: a Edge
--   Function `connections-auto-test` espera `x-cron-secret` (authorizeCron),
--   nao `apikey` -> mesmo com a URL certa, tomaria 401.
--
--   A migration 20260525113000 ja PRETENDIA este corpo (helper + x-cron-secret),
--   mas o reschedule estava guardado por IF EXISTS e nao pegou no estado real de
--   producao. Esta migration o aplica incondicionalmente (idempotente) e, por
--   ter timestamp mais recente, vence qualquer definicao legada num replay.
--
-- Pre-requisito de AMBIENTE (de proposito NAO versionado -- o valor difere por
-- ambiente). public.get_edge_functions_base_url() precisa resolver. Configure UM:
--     - Vault : secret EDGE_FUNCTIONS_BASE_URL = 'https://<project_ref>.supabase.co'
--     - GUC   : ALTER DATABASE <db> SET app.edge_functions_base_url = 'https://<project_ref>.supabase.co';
--   Ver docs/runbooks/EDGE_FUNCTIONS_BASE_URL.md
--   Se nao configurado, o helper falha-fechado com erro CLARO (em vez do
--   cryptico null-url). O agendamento em si nunca falha: cron.schedule apenas
--   armazena a string; a resolucao da URL ocorre em tempo de execucao.
--
-- Validado em prod 2026-05-30 via pg_net: HTTP 200 {"ok":true,"tested":0,...}.
-- Idempotente. Cirurgica: nao toca em nenhum outro cron.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'connections-auto-test') THEN
    PERFORM cron.unschedule('connections-auto-test');
  END IF;
END $$;

SELECT cron.schedule(
  'connections-auto-test',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := public.get_edge_functions_base_url() || '/functions/v1/connections-auto-test',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.get_edge_function_secret('CONNECTIONS_AUTO_TEST_SECRET')
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $cron$
);
