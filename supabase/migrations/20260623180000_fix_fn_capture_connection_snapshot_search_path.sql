-- =============================================================================
-- FIX: fn_capture_connection_snapshot — SET search_path = public
-- MOTIVO: SECURITY DEFINER sem SET search_path = vulnerabilidade de schema
-- injection. Descoberto em auditoria adversarial 2026-06-23.
-- DRY-RUN: retornou jsonb object correto. 1 cron dependente.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_capture_connection_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_total     int;
  v_active    int;
  v_idle_tx   int;
  v_max       int;
  v_pct       numeric(5,2);
  v_top_users jsonb;
  v_result    jsonb;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE state = 'active'),
    COUNT(*) FILTER (WHERE state = 'idle in transaction'),
    (SELECT setting::int FROM pg_settings WHERE name = 'max_connections')
  INTO v_total, v_active, v_idle_tx, v_max
  FROM pg_stat_activity
  WHERE pid != pg_backend_pid();

  v_pct := ROUND((v_total::numeric / NULLIF(v_max, 0)) * 100, 2);

  SELECT jsonb_agg(row_to_json(t)) INTO v_top_users
  FROM (
    SELECT usename, state, COUNT(*) as n
    FROM pg_stat_activity
    WHERE pid != pg_backend_pid()
    GROUP BY usename, state
    ORDER BY n DESC
    LIMIT 8
  ) t;

  INSERT INTO public.db_connection_snapshots
    (total_conns, active_conns, idle_in_tx_conns, max_conns, usage_pct, top_users)
  VALUES
    (v_total, v_active, v_idle_tx, v_max, v_pct, v_top_users);

  DELETE FROM public.db_connection_snapshots
  WHERE captured_at < now() - interval '7 days';

  v_result := jsonb_build_object(
    'total', v_total, 'active', v_active, 'idle_in_tx', v_idle_tx,
    'max', v_max, 'usage_pct', v_pct,
    'alert', v_pct >= 75
  );

  RETURN v_result;
END;
$function$;
