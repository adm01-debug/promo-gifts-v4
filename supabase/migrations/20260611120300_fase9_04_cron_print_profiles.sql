-- MEDALLION — Fase 9: agenda a inferência de perfis de gravação p/ produtos novos.
DO $$ BEGIN
  PERFORM cron.unschedule('pipeline-print-profiles');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'pipeline-print-profiles',
  '*/15 * * * *',
  $cron$ SELECT public.fn_apply_print_profiles(300, false); $cron$
);
