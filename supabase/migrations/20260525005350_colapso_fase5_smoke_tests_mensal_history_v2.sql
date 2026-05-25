-- ================================================================
-- SMOKE TESTS MENSAIS — v2 (SECURITY INVOKER porque fn_run_smoke_tests
-- interna usa RESET role que não funciona em SECURITY DEFINER)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.smoke_tests_runs (
  id           bigserial PRIMARY KEY,
  ran_at       timestamptz NOT NULL DEFAULT now(),
  test_name    text NOT NULL,
  test_category text,
  result       text NOT NULL,
  details      text,
  duration_ms  numeric
);

CREATE INDEX IF NOT EXISTS idx_smoke_tests_runs_ran_at
  ON public.smoke_tests_runs (ran_at DESC);

CREATE INDEX IF NOT EXISTS idx_smoke_tests_runs_test_result
  ON public.smoke_tests_runs (test_name, result, ran_at DESC);

ALTER TABLE public.smoke_tests_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS smoke_tests_runs_read_admin ON public.smoke_tests_runs;
CREATE POLICY smoke_tests_runs_read_admin
  ON public.smoke_tests_runs FOR SELECT
  TO authenticated
  USING (is_admin_or_above((SELECT auth.uid())));

GRANT SELECT ON public.smoke_tests_runs TO authenticated;
REVOKE ALL ON public.smoke_tests_runs FROM anon;
GRANT USAGE, SELECT ON SEQUENCE public.smoke_tests_runs_id_seq TO authenticated;

-- Wrapper SECURITY INVOKER (default)
CREATE OR REPLACE FUNCTION public.fn_run_and_persist_smoke_tests()
RETURNS TABLE(
  ran_at timestamptz,
  total_tests int,
  passed int,
  failed int,
  warned int,
  failed_tests text[]
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_ran_at timestamptz := now();
  v_total int := 0;
  v_passed int := 0;
  v_failed int := 0;
  v_warned int := 0;
  v_failed_tests text[] := ARRAY[]::text[];
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM public.fn_run_smoke_tests() LOOP
    v_total := v_total + 1;
    
    INSERT INTO public.smoke_tests_runs (
      ran_at, test_name, test_category, result, details, duration_ms
    ) VALUES (
      v_ran_at, r.test_name, r.test_category, r.result, r.details, r.duration_ms
    );
    
    IF upper(r.result) = 'PASS' THEN v_passed := v_passed + 1;
    ELSIF upper(r.result) = 'FAIL' THEN 
      v_failed := v_failed + 1;
      v_failed_tests := array_append(v_failed_tests, r.test_name);
    ELSIF upper(r.result) IN ('WARN','WARNING') THEN v_warned := v_warned + 1;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_ran_at, v_total, v_passed, v_failed, v_warned, v_failed_tests;
END;
$$;

COMMENT ON FUNCTION public.fn_run_and_persist_smoke_tests() IS
'Wrapper SECURITY INVOKER. Roda fn_run_smoke_tests(), persiste em smoke_tests_runs e retorna sumário.
Cron mensal + execução manual via dashboard admin.';

-- Grant para admin/postgres executar
GRANT EXECUTE ON FUNCTION public.fn_run_and_persist_smoke_tests() TO postgres;
GRANT EXECUTE ON FUNCTION public.fn_run_and_persist_smoke_tests() TO authenticated;

-- Views
CREATE OR REPLACE VIEW public.v_smoke_tests_latest_run 
WITH (security_invoker = on) AS
WITH latest AS (
  SELECT max(ran_at) AS ran_at FROM public.smoke_tests_runs
)
SELECT 
  r.ran_at, r.test_name, r.test_category, r.result, r.details, r.duration_ms
FROM public.smoke_tests_runs r
JOIN latest l ON r.ran_at = l.ran_at
ORDER BY 
  CASE upper(r.result) 
    WHEN 'FAIL' THEN 1 WHEN 'WARN' THEN 2 WHEN 'PASS' THEN 3 ELSE 4
  END, r.test_name;

GRANT SELECT ON public.v_smoke_tests_latest_run TO authenticated;
REVOKE SELECT ON public.v_smoke_tests_latest_run FROM anon;

CREATE OR REPLACE VIEW public.v_smoke_tests_trend 
WITH (security_invoker = on) AS
SELECT 
  ran_at,
  count(*) AS total,
  count(*) FILTER (WHERE upper(result) = 'PASS')         AS passed,
  count(*) FILTER (WHERE upper(result) = 'FAIL')         AS failed,
  count(*) FILTER (WHERE upper(result) IN ('WARN','WARNING')) AS warned,
  round(avg(duration_ms)::numeric, 1)                    AS avg_duration_ms
FROM public.smoke_tests_runs
GROUP BY ran_at
ORDER BY ran_at DESC
LIMIT 12;

GRANT SELECT ON public.v_smoke_tests_trend TO authenticated;
REVOKE SELECT ON public.v_smoke_tests_trend FROM anon;

-- Cron mensal (dia 1, 03h UTC — domingo madrugada se cair, sem impacto)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'smoke_tests_monthly') THEN
    PERFORM cron.schedule(
      'smoke_tests_monthly',
      '0 3 1 * *',
      $cron$ SELECT public.fn_run_and_persist_smoke_tests(); $cron$
    );
  END IF;
END $$;

-- Rotação: manter últimas 24 execuções (~2 anos)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'smoke_tests_runs_purge') THEN
    PERFORM cron.schedule(
      'smoke_tests_runs_purge',
      '0 4 1 * *',
      $cron$
        DELETE FROM public.smoke_tests_runs 
        WHERE ran_at < (
          SELECT min(ran_at) FROM (
            SELECT DISTINCT ran_at FROM public.smoke_tests_runs 
            ORDER BY ran_at DESC LIMIT 24
          ) keep
        );
      $cron$
    );
  END IF;
END $$;
