-- ============================================================================
-- Torna DURAVEL a remocao do cron job "external-db-bridge-keepalive".
-- ----------------------------------------------------------------------------
-- Contexto (CORRECAO-03):
--   A Edge Function `external-db-bridge` foi descontinuada (HTTP 410); o
--   frontend migrou para PostgREST nativo. O cron que a "mantinha quente"
--   (`external-db-bridge-keepalive`, jobid 35 em producao) continuava
--   disparando a cada poucos minutos e falhava SEMPRE com:
--       ERROR: null value in column "url" of relation "http_request_queue"
--   pois montava a URL a partir de current_setting('app.supabase_functions_base_url')
--   = NULL. Acumulou 1600+ execucoes "failed", poluindo cron.job_run_details.
--
--   Foi desativado em runtime via `cron.unschedule(35)` -- porem isso NAO estava
--   versionado. Migrations anteriores ainda (re)criam o job:
--     - 20260424154125_0988f1e1-...    -> CREATE inicial do keepalive
--     - 20260525113000_runtime_edge_function_base_url.sql -> unschedule + reschedule
--   Logo, um `supabase db reset` / replay da historia poderia RESSUSCITA-LO.
--
--   Como esta migration tem o timestamp mais recente, ela roda POR ULTIMO e
--   garante que o estado final seja sempre: job ausente.
--
-- Propriedades:
--   * Idempotente  -- seguro reaplicar quantas vezes for.
--   * Fail-open    -- no-op silencioso quando o job nao existe (estado atual).
--   * Cirurgica    -- nao toca em nenhum outro cron (connections-auto-test,
--                    process-queue, watchers, purges etc. permanecem intactos).
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  -- 1) Remove pelo nome canonico, se ainda existir.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'external-db-bridge-keepalive') THEN
    PERFORM cron.unschedule('external-db-bridge-keepalive');
    RAISE NOTICE 'Removido cron job: external-db-bridge-keepalive';
  END IF;

  -- 2) Defesa em profundidade: remove QUALQUER cron cujo comando ainda aponte
  --    para a Edge Function descontinuada, independentemente de jobid/jobname
  --    (cobre uma eventual ressurreicao sob outro nome ou id).
  FOR r IN
    SELECT jobid, jobname
    FROM cron.job
    WHERE command LIKE '%/functions/v1/external-db-bridge%'
  LOOP
    IF r.jobname IS NOT NULL THEN
      PERFORM cron.unschedule(r.jobname);
    ELSE
      PERFORM cron.unschedule(r.jobid);
    END IF;
    RAISE NOTICE 'Removido cron orfao apontando para external-db-bridge: id=% name=%', r.jobid, r.jobname;
  END LOOP;
END $$;
