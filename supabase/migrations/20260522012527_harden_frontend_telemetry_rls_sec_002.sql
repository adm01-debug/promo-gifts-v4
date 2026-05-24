BEGIN;
DROP POLICY IF EXISTS "Anyone can insert telemetry" ON public.frontend_telemetry;
DROP POLICY IF EXISTS frontend_telemetry_insert_anon ON public.frontend_telemetry;
DROP POLICY IF EXISTS frontend_telemetry_insert_authenticated ON public.frontend_telemetry;
CREATE POLICY frontend_telemetry_insert_anon ON public.frontend_telemetry FOR INSERT TO anon
  WITH CHECK (user_id IS NULL AND length(coalesce(event_type,'')) BETWEEN 1 AND 64 AND length(coalesce(name,'')) BETWEEN 1 AND 256 AND length(coalesce(url,'')) <= 2048 AND length(coalesce(user_agent,'')) <= 1024 AND length(coalesce(session_id,'')) <= 128 AND length(coalesce(metadata::text,'')) <= 8192);
CREATE POLICY frontend_telemetry_insert_authenticated ON public.frontend_telemetry FOR INSERT TO authenticated
  WITH CHECK ((user_id IS NULL OR user_id = (select auth.uid())) AND length(coalesce(event_type,'')) BETWEEN 1 AND 64 AND length(coalesce(name,'')) BETWEEN 1 AND 256 AND length(coalesce(url,'')) <= 2048 AND length(coalesce(user_agent,'')) <= 1024 AND length(coalesce(session_id,'')) <= 128 AND length(coalesce(metadata::text,'')) <= 8192);
ALTER TABLE public.frontend_telemetry DROP CONSTRAINT IF EXISTS frontend_telemetry_size_caps_check;
ALTER TABLE public.frontend_telemetry ADD CONSTRAINT frontend_telemetry_size_caps_check CHECK (length(coalesce(event_type,'')) BETWEEN 1 AND 64 AND length(coalesce(name,'')) BETWEEN 1 AND 256 AND length(coalesce(url,'')) <= 2048 AND length(coalesce(user_agent,'')) <= 1024 AND length(coalesce(session_id,'')) <= 128 AND length(coalesce(metadata::text,'')) <= 8192);
COMMIT;
