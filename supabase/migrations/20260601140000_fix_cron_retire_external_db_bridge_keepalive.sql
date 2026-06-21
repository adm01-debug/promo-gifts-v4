-- A edge function external-db-bridge está aposentada (kill-switch OFF, Caminho B concluído).
-- O cron job 'external-db-bridge-keepalive' (a cada 4 min) tentava fazer net.http_post
-- para essa função, mas 'app.supabase_functions_base_url' nunca foi configurado via
-- ALTER DATABASE → url=NULL → violação NOT NULL em net.http_request_queue → 14+ falhas/hora.
-- Essas falhas derrubavam o smoke test cron_health_1h (conta qualquer falha na última hora).
--
-- Solução: remover o job. A bridge não receberá deploy — não há razão para mantê-la ativa.
-- Idempotente via DO/EXCEPTION: cron.unschedule lança XX000 se o job não existir
-- (não retorna false como a documentação antiga sugeria); o bloco captura e ignora.

DO $$
BEGIN
  PERFORM cron.unschedule('external-db-bridge-keepalive');
EXCEPTION WHEN OTHERS THEN
  -- Job not present in this environment (e.g. fresh CI DB) — nothing to remove.
  NULL;
END;
$$;
