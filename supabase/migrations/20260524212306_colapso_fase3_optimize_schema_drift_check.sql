-- =============================================================
-- FASE 3 — Otimização da fn_run_schema_drift_check
-- Antes: até 60s segurando conexão (60 × pg_sleep(1))
-- Depois: até 30s, polling a cada 500ms (60 × pg_sleep(0.5))
-- Reduz tempo máximo em 50% e mantém responsividade.
-- =============================================================

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
  v_max_attempts int := 60;   -- 60 × 500ms = 30s total (era 60s)
  v_sleep_sec    numeric := 0.5;
  v_status_code  int;
BEGIN
  -- Dispara fetch
  v_request_id := public.fn_trigger_schema_drift_fetch();

  -- Polling pelo resultado (mais responsivo: 500ms em vez de 1s)
  LOOP
    v_attempts := v_attempts + 1;
    PERFORM pg_sleep(v_sleep_sec);

    SELECT status_code, content::jsonb
      INTO v_status_code, v_response
      FROM net._http_response
      WHERE id = v_request_id;

    EXIT WHEN v_status_code IS NOT NULL;

    IF v_attempts >= v_max_attempts THEN
      -- Timeout: grava erro com sinal claro de oportunidade de async
      v_log_id := public.record_schema_drift_result(jsonb_build_object(
        'has_drift', false,
        'tables_oficial', 0,
        'tables_lovable', 0,
        'only_oficial', '[]'::jsonb,
        'only_lovable', '[]'::jsonb,
        'schema_diff', '{}'::jsonb,
        'error_message', format('Timeout 30s (request_id=%s, %s tentativas de 500ms). Considere migrar para padrão async (trigger + finalize separado).', v_request_id, v_attempts)
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

COMMENT ON FUNCTION public.fn_run_schema_drift_check() IS
'Schema drift check via Lovable webhook. Otimizado em 2026-05-24 fase 3:
 polling 500ms (era 1s), timeout 30s (era 60s).
 Idealmente migrar para padrão async (dispara + cron de finalização separado)
 para liberar conexão Postgres durante o cold-start do Lovable.';
