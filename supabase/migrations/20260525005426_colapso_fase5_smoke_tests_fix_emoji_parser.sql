-- ================================================================
-- FIX: fn_run_smoke_tests retorna result com emoji prefix
-- ("✅ PASS", "❌ FAIL", "⚠️ WARN"). Ajustar parser para usar LIKE.
-- ================================================================

-- Replay-safe: DROP antes de recriar para evitar 42P13 se o tipo de retorno diferir.
DROP FUNCTION IF EXISTS public.fn_run_and_persist_smoke_tests();

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
    
    -- Match com emoji prefix (✅ PASS, ❌ FAIL, ⚠️ WARN)
    IF r.result ILIKE '%PASS%' THEN 
      v_passed := v_passed + 1;
    ELSIF r.result ILIKE '%FAIL%' THEN 
      v_failed := v_failed + 1;
      v_failed_tests := array_append(v_failed_tests, r.test_name);
    ELSIF r.result ILIKE '%WARN%' THEN 
      v_warned := v_warned + 1;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_ran_at, v_total, v_passed, v_failed, v_warned, v_failed_tests;
END;
$$;

-- View latest_run ajustar ordenação para emoji prefix
-- Replay-safe: DROP antes evita 42P16 se o snapshot do preview já tiver a view
-- com tipos de coluna diferentes (ex.: count(*)::integer da migration 063000).
DROP VIEW IF EXISTS public.v_smoke_tests_latest_run;
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
  CASE
    WHEN r.result ILIKE '%FAIL%' THEN 1
    WHEN r.result ILIKE '%WARN%' THEN 2
    WHEN r.result ILIKE '%PASS%' THEN 3
    ELSE 4
  END,
  r.test_name;

-- View trend ajustar
DROP VIEW IF EXISTS public.v_smoke_tests_trend;
CREATE OR REPLACE VIEW public.v_smoke_tests_trend
WITH (security_invoker = on) AS
SELECT
  ran_at,
  count(*) AS total,
  count(*) FILTER (WHERE result ILIKE '%PASS%') AS passed,
  count(*) FILTER (WHERE result ILIKE '%FAIL%') AS failed,
  count(*) FILTER (WHERE result ILIKE '%WARN%') AS warned,
  round(avg(duration_ms)::numeric, 1) AS avg_duration_ms
FROM public.smoke_tests_runs
GROUP BY ran_at
ORDER BY ran_at DESC
LIMIT 12;
