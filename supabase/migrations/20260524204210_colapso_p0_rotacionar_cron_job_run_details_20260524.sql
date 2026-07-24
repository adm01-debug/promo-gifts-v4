-- =============================================================
-- P0.4 — Rotacionar cron.job_run_details (33 MB / 91k linhas)
-- Mantém apenas últimos 14 dias. Cria job de manutenção semanal.
-- =============================================================
DELETE FROM cron.job_run_details
 WHERE start_time < now() - interval '14 days';

-- Schedulando rotação semanal (domingo 04:00)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='cron_job_run_details_purge_weekly') THEN
    PERFORM cron.schedule(
      'cron_job_run_details_purge_weekly',
      '0 4 * * 0',
      $cmd$ DELETE FROM cron.job_run_details WHERE start_time < now() - interval '14 days' $cmd$
    );
  END IF;
END$$;
