-- Migration: P0.4 — Rotação de cron.job_run_details
-- Contexto: cron.job_run_details acumulou 91k linhas / 33 MB.
-- Esta migration faz purge inicial (>14 dias) e cria job semanal de rotação.
-- Aplicada em produção em 2026-05-24.

DELETE FROM cron.job_run_details
 WHERE start_time < now() - interval '14 days';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='cron_job_run_details_purge_weekly') THEN
    PERFORM cron.schedule(
      'cron_job_run_details_purge_weekly',
      '0 4 * * 0',  -- domingos 04:00 UTC
      $cmd$ DELETE FROM cron.job_run_details WHERE start_time < now() - interval '14 days' $cmd$
    );
  END IF;
END$$;
