-- APLICADO 2026-06-23 | Melhoria 3/7: pg_cron auto-reload pgrst + fn_pgrst_reload()
CREATE OR REPLACE FUNCTION public.fn_pgrst_reload() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); END; $$;
COMMENT ON FUNCTION public.fn_pgrst_reload() IS 'Forca reload do schema cache do PostgREST. Usar apos migrations.';
GRANT EXECUTE ON FUNCTION public.fn_pgrst_reload() TO authenticated;
SELECT cron.schedule('pgrst-schema-reload', '*/15 * * * *', $$SELECT public.fn_pgrst_reload();$$);
