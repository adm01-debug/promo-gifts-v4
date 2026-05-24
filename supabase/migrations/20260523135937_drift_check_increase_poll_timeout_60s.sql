-- Mitigação do timeout do schema-drift-check (auditoria 2026-05-23).
-- Causa: cold-start do endpoint Lovable às 02:00 excedeu a janela de polling de 30s.
-- Ação: aumenta v_max_attempts 30 -> 60 (60s). Resto IDÊNTICO à versão anterior.
-- Aplicada na live como version 20260523135937.
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
  v_max_attempts int := 60;  -- ate 60s (era 30s; cold-start do Lovable excedia a janela)
  v_status_code  int;
BEGIN
  -- Dispara fetch
  v_request_id := public.fn_trigger_schema_drift_fetch();

  -- Polling pelo resultado
  LOOP
    v_attempts := v_attempts + 1;
    PERFORM pg_sleep(1);

    SELECT status_code, content::jsonb
      INTO v_status_code, v_response
      FROM net._http_response
      WHERE id = v_request_id;

    EXIT WHEN v_status_code IS NOT NULL;

    IF v_attempts >= v_max_attempts THEN
      -- Timeout: grava erro
      v_log_id := public.record_schema_drift_result(jsonb_build_object(
        'has_drift', false,
        'tables_oficial', 0,
        'tables_lovable', 0,
        'only_oficial', '[]'::jsonb,
        'only_lovable', '[]'::jsonb,
        'schema_diff', '{}'::jsonb,
        'error_message', format('Timeout aguardando Lovable (request_id=%s, %s tentativas)', v_request_id, v_attempts)
      ));
      RETURN jsonb_build_object('ok', false, 'error', 'timeout', 'log_id', v_log_id);
    END IF;
  END LOOP;

  -- Validar resposta
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

  -- Computa diff e grava
  v_lovable_sigs := v_response;
  v_log_id := public.fn_compute_and_record_drift(v_lovable_sigs);

  RETURN jsonb_build_object('ok', true, 'log_id', v_log_id, 'request_id', v_request_id);
END;
$function$;
