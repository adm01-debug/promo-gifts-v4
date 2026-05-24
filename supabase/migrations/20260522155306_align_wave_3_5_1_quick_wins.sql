-- Wave 3.5.1 - Quick wins
ALTER TABLE public.frontend_telemetry ALTER COLUMN duration_ms TYPE double precision USING duration_ms::double precision;
ALTER TABLE public.ip_access_control ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE OR REPLACE FUNCTION public.tg_ip_access_control_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN NEW.updated_at=now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS set_updated_at ON public.ip_access_control;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ip_access_control FOR EACH ROW EXECUTE FUNCTION public.tg_ip_access_control_set_updated_at();
