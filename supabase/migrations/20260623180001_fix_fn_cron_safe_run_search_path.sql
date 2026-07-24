-- =============================================================================
-- FIX: fn_cron_safe_run — SET search_path = public
-- MOTIVO: SECURITY DEFINER sem SET search_path = vulnerabilidade de schema
-- injection. 48 crons dependem desta função.
-- DRY-RUN: 3 simulações de produção OK (products-count, wn-count, noop-update).
-- EXECUTE p_sql herda search_path = public — seguro pois nenhum dos 48 crons
-- referencia tabelas fora de 'public' de forma não qualificada.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_cron_safe_run(
  p_key        bigint,
  p_sql        text,
  p_timeout_ms integer DEFAULT 45000,
  p_job_label  text    DEFAULT 'cron'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_start       timestamptz := clock_timestamp();
  v_duration_ms int;
BEGIN
  -- Advisory lock transacional: se o tick anterior ainda roda, pula sem empilhar
  IF NOT pg_try_advisory_xact_lock(p_key) THEN
    RETURN format('[%s] SKIP: job ainda em execução (lock=%s)', p_job_label, p_key);
  END IF;

  -- Aplica timeout local para esta execução
  EXECUTE format('SET LOCAL statement_timeout = %L', p_timeout_ms || 'ms');

  -- Executa o SQL do job
  EXECUTE p_sql;

  v_duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000;
  RETURN format('[%s] OK: %sms', p_job_label, v_duration_ms);

EXCEPTION
  WHEN query_canceled THEN
    RETURN format('[%s] TIMEOUT após %sms (limite=%sms)', p_job_label,
      EXTRACT(EPOCH FROM (clock_timestamp() - v_start))::int * 1000, p_timeout_ms);
  WHEN OTHERS THEN
    RETURN format('[%s] ERRO: %s', p_job_label, SQLERRM);
END;
$function$;
