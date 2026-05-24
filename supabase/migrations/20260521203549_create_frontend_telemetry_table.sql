CREATE TABLE IF NOT EXISTS public.frontend_telemetry (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text NOT NULL,
  name        text NOT NULL,
  duration_ms numeric,
  metadata    jsonb DEFAULT '{}'::jsonb,
  url         text,
  user_agent  text,
  session_id  text,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS frontend_telemetry_created_at_idx ON public.frontend_telemetry (created_at DESC);
CREATE INDEX IF NOT EXISTS frontend_telemetry_event_type_idx ON public.frontend_telemetry (event_type);
CREATE INDEX IF NOT EXISTS frontend_telemetry_user_id_idx ON public.frontend_telemetry (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.frontend_telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY frontend_telemetry_insert_authenticated ON public.frontend_telemetry FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY frontend_telemetry_insert_anon ON public.frontend_telemetry FOR INSERT TO anon WITH CHECK (true);
