DROP POLICY IF EXISTS "Anyone can request a password reset" ON public.password_reset_requests;
DROP POLICY IF EXISTS "Anyone can create password reset request" ON public.password_reset_requests;

CREATE POLICY "Public can request password reset with valid payload"
ON public.password_reset_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  email = lower(btrim(email))
  AND length(email) BETWEEN 6 AND 254
  AND email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
  AND status = 'pending'
  AND requested_at >= (now() - interval '5 minutes')
  AND requested_at <= (now() + interval '5 minutes')
  AND reviewed_at IS NULL
  AND reviewed_by IS NULL
  AND reviewer_notes IS NULL
  AND (
    user_id IS NULL
    OR user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Anyone can insert telemetry" ON public.frontend_telemetry;
DROP POLICY IF EXISTS "Authenticated users can insert telemetry" ON public.frontend_telemetry;

CREATE POLICY "Public can insert bounded frontend telemetry"
ON public.frontend_telemetry
FOR INSERT
TO anon, authenticated
WITH CHECK (
  event_type IN ('error', 'performance', 'ux_action', 'api_fail')
  AND length(btrim(name)) BETWEEN 1 AND 256
  AND (duration_ms IS NULL OR (duration_ms >= 0 AND duration_ms <= 600000))
  AND (metadata IS NULL OR pg_column_size(metadata) <= 8192)
  AND (url IS NULL OR length(url) <= 2048)
  AND (user_agent IS NULL OR length(user_agent) <= 1024)
  AND (session_id IS NULL OR length(session_id) BETWEEN 1 AND 128)
  AND (
    user_id IS NULL
    OR user_id = auth.uid()
  )
);

CREATE POLICY "Service can insert frontend telemetry"
ON public.frontend_telemetry
FOR INSERT
TO service_role
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');