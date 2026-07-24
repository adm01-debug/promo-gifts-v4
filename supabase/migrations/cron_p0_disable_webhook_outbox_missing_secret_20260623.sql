-- P0: Desabilitar cron process-webhook-outbox (jobid=202) — secret WEBHOOK_DISPATCHER_URL ausente
SELECT cron.alter_job(202, active := false);
