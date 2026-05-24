-- Fase 4 - pg_cron schema-drift-check diario 02:00
SELECT cron.schedule('schema-drift-check','0 2 * * *',$$SELECT public.fn_run_schema_drift_check();$$) AS jobid;
