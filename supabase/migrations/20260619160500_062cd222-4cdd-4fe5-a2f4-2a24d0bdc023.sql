-- Onda 7 (corrigida) — RLS WITH CHECK em password_reset_requests + frontend_telemetry

-- 1) password_reset_requests
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
     WHERE schemaname='public' AND tablename='password_reset_requests' AND cmd='INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.password_reset_requests', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "prr_insert_validated"
  ON public.password_reset_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    AND length(email) <= 320
    AND NOT EXISTS (
      SELECT 1 FROM public.password_reset_requests prr
       WHERE lower(prr.email) = lower(password_reset_requests.email)
         AND prr.requested_at > now() - interval '60 seconds'
    )
  );

-- 2) frontend_telemetry
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
     WHERE schemaname='public' AND tablename='frontend_telemetry' AND cmd='INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.frontend_telemetry', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "ft_insert_validated"
  ON public.frontend_telemetry
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    event_type IN ('page_view','web_vital','error','perf','interaction')
    AND length(coalesce(metadata::text, '')) < 8000
  );
