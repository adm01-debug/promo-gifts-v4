-- CRÍTICO (Fase 9): restaura o cron PRINCIPAL de ingestão (process-pending-products),
-- que havia sido removido entre sessões. Sem ele, raws ficam 'pending' indefinidamente
-- (900 acumuladas foram encontradas paradas em 2026-06-11). Detectado pela validação
-- consolidada (esperado 4 crons ativos, encontrado 3).
DO $$ BEGIN
  PERFORM cron.unschedule('process-pending-products');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'process-pending-products',
  '*/5 * * * *',
  $cron$ SELECT * FROM process_pending_batches(); $cron$
);
