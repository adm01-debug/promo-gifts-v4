-- Restore the smoke-test observability contract consumed by useSmokeTests.
-- The frontend reads v_smoke_tests_latest_run/v_smoke_tests_trend and triggers
-- fn_run_and_persist_smoke_tests(); keep all objects replay-safe.

CREATE TABLE IF NOT EXISTS public.smoke_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  test_name text NOT NULL,
  test_category text,
  result text NOT NULL,
  details text,
  duration_ms numeric
);

DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='smoke_test_runs' AND column_name IN ('ran_at')) = 1 THEN
    CREATE INDEX IF NOT EXISTS idx_smoke_test_runs_ran_at
  ON public.smoke_test_runs (ran_at DESC);
  END IF;
END $$;

DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='smoke_test_runs' AND column_name IN ('test_name','ran_at')) = 2 THEN
    CREATE INDEX IF NOT EXISTS idx_smoke_test_runs_name_ran_at
  ON public.smoke_test_runs (test_name, ran_at DESC);
  END IF;
END $$;

ALTER TABLE public.smoke_test_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.smoke_test_runs FROM anon;
GRANT SELECT, INSERT ON TABLE public.smoke_test_runs TO authenticated;

DROP POLICY IF EXISTS smoke_test_runs_select_admin ON public.smoke_test_runs;
CREATE POLICY smoke_test_runs_select_admin
  ON public.smoke_test_runs FOR SELECT
  TO authenticated
  USING (public.is_admin_or_above((SELECT auth.uid())));

DROP POLICY IF EXISTS smoke_test_runs_insert_admin ON public.smoke_test_runs;
CREATE POLICY smoke_test_runs_insert_admin
  ON public.smoke_test_runs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_above((SELECT auth.uid())));

-- Replay-safe: em preview-branches a função pode já existir como RETURNS TABLE
-- (criada por 20260525005350/005426); CREATE OR REPLACE não muda o tipo de
-- retorno → ERROR 42P13. DROP antes garante recriação como RETURNS void.
-- Sem dependentes de schema em produção (verificado via pg_depend).
DROP FUNCTION IF EXISTS public.fn_run_and_persist_smoke_tests();
CREATE OR REPLACE FUNCTION public.fn_run_and_persist_smoke_tests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ran_at timestamptz := now();
BEGIN
  IF NOT public.is_admin_or_above((SELECT auth.uid())) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.smoke_test_runs (
    ran_at,
    test_name,
    test_category,
    result,
    details,
    duration_ms
  )
  SELECT
    v_ran_at,
    test_name,
    test_category,
    result,
    details,
    duration_ms
  FROM public.fn_run_smoke_tests();
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_run_and_persist_smoke_tests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_run_and_persist_smoke_tests() TO authenticated;

-- DROP+CREATE (não OR REPLACE): em prod a view já existe com colunas count(*)
-- em bigint; CREATE OR REPLACE não pode mudar o tipo p/ integer. DROP recria
-- limpo (nada depende destas views — verificado em pg_depend).
DROP VIEW IF EXISTS public.v_smoke_tests_latest_run;
CREATE VIEW public.v_smoke_tests_latest_run
WITH (security_invoker = on) AS
SELECT
  ran_at,
  test_name,
  test_category,
  result,
  details,
  duration_ms
FROM public.smoke_test_runs
WHERE ran_at = (SELECT max(ran_at) FROM public.smoke_test_runs)
ORDER BY
  CASE
    WHEN result LIKE '%FAIL%' THEN 0
    WHEN result LIKE '%WARN%' THEN 1
    ELSE 2
  END,
  test_name;

DROP VIEW IF EXISTS public.v_smoke_tests_trend;
CREATE VIEW public.v_smoke_tests_trend
WITH (security_invoker = on) AS
SELECT
  ran_at,
  count(*)::integer AS total,
  count(*) FILTER (WHERE result LIKE '%PASS%')::integer AS passed,
  count(*) FILTER (WHERE result LIKE '%FAIL%')::integer AS failed,
  count(*) FILTER (WHERE result LIKE '%WARN%')::integer AS warned,
  avg(duration_ms) AS avg_duration_ms
FROM public.smoke_test_runs
GROUP BY ran_at
ORDER BY ran_at DESC
LIMIT 12;

GRANT SELECT ON public.v_smoke_tests_latest_run TO authenticated;
GRANT SELECT ON public.v_smoke_tests_trend TO authenticated;
REVOKE SELECT ON public.v_smoke_tests_latest_run FROM anon;
REVOKE SELECT ON public.v_smoke_tests_trend FROM anon;

COMMENT ON TABLE public.smoke_test_runs IS
  'Persisted smoke-test results used by the admin observability dashboard.';
COMMENT ON VIEW public.v_smoke_tests_latest_run IS
  'Latest persisted smoke-test execution, ordered by severity.';
COMMENT ON VIEW public.v_smoke_tests_trend IS
  'Last 12 persisted smoke-test executions with aggregate counts.';
