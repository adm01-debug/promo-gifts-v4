-- =============================================================================
-- FIX: Re-aplicar SET search_path nas 3 funções SECURITY DEFINER revertidas
-- pelo Lovable bot (commit d1be8ac02 feat(gravacao)).
-- FUNÇÕES:
--   fn_cron_watchdog        (nova, nunca teve search_path)
--   fn_cron_safe_run        (revertida — 48 crons dependem)
--   fn_capture_connection_snapshot (revertida — 1 cron)
-- AUDITORIA: Round 5 (2026-06-23) — zero SECDEF sem search_path após este fix.
-- =============================================================================

-- 1. fn_cron_watchdog
CREATE OR REPLACE FUNCTION public.fn_cron_watchdog()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_killed int := 0; v_rec record;
BEGIN
  FOR v_rec IN
    SELECT a.pid, a.query_start,
      ROUND(EXTRACT(EPOCH FROM (now()-a.query_start))*1000)::bigint AS duration_ms,
      (regexp_match(a.query,'''([^'']+)'''))[1] AS job_label,
      COALESCE((SELECT m.timeout_sec FROM public.cron_job_timeout_map m
         WHERE a.query ILIKE '%'||m.jobname||'%' LIMIT 1),55) AS timeout_sec
    FROM pg_stat_activity a
    WHERE a.application_name='pg_cron' AND a.state='active'
      AND a.query_start IS NOT NULL
      AND a.query NOT ILIKE '%fn_cron_watchdog%'
      AND a.pid != pg_backend_pid()
  LOOP
    IF v_rec.duration_ms > (v_rec.timeout_sec * 1000) THEN
      INSERT INTO public.cron_watchdog_log(pid,jobname,query_start,duration_ms,query_preview)
      VALUES(v_rec.pid,COALESCE(v_rec.job_label,'unknown'),v_rec.query_start,v_rec.duration_ms,'watchdog-kill');
      PERFORM pg_cancel_backend(v_rec.pid);
      v_killed := v_killed + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('killed',v_killed,'action',
    CASE WHEN v_killed>0 THEN 'KILLED:'||v_killed ELSE 'ALL_OK' END);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error',SQLERRM);
END; $fn$;

-- 2. fn_cron_safe_run (48 crons)
CREATE OR REPLACE FUNCTION public.fn_cron_safe_run(
  p_key bigint, p_sql text,
  p_timeout_ms integer DEFAULT 45000,
  p_job_label text DEFAULT 'cron'
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_start timestamptz := clock_timestamp(); v_duration_ms int;
BEGIN
  IF NOT pg_try_advisory_xact_lock(p_key) THEN
    RETURN format('[%s] SKIP: job ainda em execucao (lock=%s)', p_job_label, p_key);
  END IF;
  EXECUTE format('SET LOCAL statement_timeout = %L', p_timeout_ms||'ms');
  EXECUTE p_sql;
  v_duration_ms := EXTRACT(EPOCH FROM (clock_timestamp()-v_start))*1000;
  RETURN format('[%s] OK: %sms', p_job_label, v_duration_ms);
EXCEPTION
  WHEN query_canceled THEN
    RETURN format('[%s] TIMEOUT apos %sms', p_job_label,
      EXTRACT(EPOCH FROM (clock_timestamp()-v_start))::int*1000);
  WHEN OTHERS THEN RETURN format('[%s] ERRO: %s', p_job_label, SQLERRM);
END; $fn$;

-- 3. fn_capture_connection_snapshot (1 cron)
CREATE OR REPLACE FUNCTION public.fn_capture_connection_snapshot()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_total int; v_active int; v_idle_tx int; v_max int;
  v_pct numeric(5,2); v_top_users jsonb; v_result jsonb;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE state='active'),
    COUNT(*) FILTER (WHERE state='idle in transaction'),
    (SELECT setting::int FROM pg_settings WHERE name='max_connections')
  INTO v_total, v_active, v_idle_tx, v_max
  FROM pg_stat_activity WHERE pid != pg_backend_pid();
  v_pct := ROUND((v_total::numeric/NULLIF(v_max,0))*100,2);
  SELECT jsonb_agg(row_to_json(t)) INTO v_top_users FROM (
    SELECT usename,state,COUNT(*) as n FROM pg_stat_activity
    WHERE pid!=pg_backend_pid() GROUP BY usename,state ORDER BY n DESC LIMIT 8) t;
  INSERT INTO public.db_connection_snapshots
    (total_conns,active_conns,idle_in_tx_conns,max_conns,usage_pct,top_users)
  VALUES(v_total,v_active,v_idle_tx,v_max,v_pct,v_top_users);
  DELETE FROM public.db_connection_snapshots WHERE captured_at<now()-interval '7 days';
  RETURN jsonb_build_object('total',v_total,'active',v_active,
    'idle_in_tx',v_idle_tx,'max',v_max,'usage_pct',v_pct,'alert',v_pct>=75);
END; $fn$;
