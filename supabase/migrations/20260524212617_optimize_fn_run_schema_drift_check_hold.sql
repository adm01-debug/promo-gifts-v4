CREATE OR REPLACE FUNCTION public.fn_run_schema_drift_check()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request_id   bigint;
  v_response     jsonb;
  v_lovable_sigs jsonb;
  v_log_id       uuid;
  v_attempts     int := 0;
  v_max_attempts int := 30;
  v_sleep_sec    numeric := 0.5;
  v_status_code  int;
BEGIN
  v_request_id := public.fn_trigger_schema_drift_fetch();

  LOOP
    v_attempts := v_attempts + 1;
    PERFORM pg_sleep(v_sleep_sec);

    SELECT status_code, content::jsonb
      INTO v_status_code, v_response
      FROM net._http_response
      WHERE id = v_request_id;

    EXIT WHEN v_status_code IS NOT NULL;

    IF v_attempts >= v_max_attempts THEN
      v_log_id := public.record_schema_drift_result(jsonb_build_object(
        'has_drift', false,
        'tables_oficial', 0,
        'tables_lovable', 0,
        'only_oficial', '[]'::jsonb,
        'only_lovable', '[]'::jsonb,
        'schema_diff', '{}'::jsonb,
        'error_message', format('Timeout 15s (request_id=%s, %s tentativas de 500ms). Considere migrar para padrão async (trigger + finalize separado).', v_request_id, v_attempts)
      ));
      RETURN jsonb_build_object('ok', false, 'error', 'timeout', 'log_id', v_log_id);
    END IF;
  END LOOP;

  IF v_status_code != 200 THEN
    v_log_id := public.record_schema_drift_result(jsonb_build_object(
      'has_drift', false,
      'tables_oficial', 0,
      'tables_lovable', 0,
      'only_oficial', '[]'::jsonb,
      'only_lovable', '[]'::jsonb,
      'schema_diff', '{}'::jsonb,
      'error_message', format('Lovable retornou HTTP %s: %s', v_status_code, v_response::text)
    ));
    RETURN jsonb_build_object('ok', false, 'error', 'http_'||v_status_code, 'log_id', v_log_id);
  END IF;

  v_lovable_sigs := v_response;
  v_log_id := public.fn_compute_and_record_drift(v_lovable_sigs);

  RETURN jsonb_build_object('ok', true, 'log_id', v_log_id, 'request_id', v_request_id);
END;
$function$;
