-- =============================================================
-- P0.1 — Forçar invalidação de plan cache do cron worker
-- Bug: cron job "purge-expired-security" chama `purge_expired_step_up_artifacts(60, 60)`,
-- assinatura que NÃO EXISTE no banco (a função real é sem args).
-- O def atual de purge_expired_security_data já está correto, mas o plan cache do
-- pg_cron worker ficou "zumbi". DROP + CREATE força replan.
-- =============================================================
DROP FUNCTION IF EXISTS public.purge_expired_security_data();

CREATE OR REPLACE FUNCTION public.purge_expired_security_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_purged_step_up integer;
  v_purged_logins  integer;
BEGIN
  v_purged_step_up := public.purge_expired_step_up_artifacts();

  DELETE FROM public.login_attempts
   WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_purged_logins = ROW_COUNT;

  -- Telemetria leve em audit_log para diagnóstico futuro
  PERFORM 1; -- placeholder; o ROW_COUNT serve aos logs do cron
END;
$function$;

COMMENT ON FUNCTION public.purge_expired_security_data() IS
'Limpeza periódica de artefatos de segurança. Recriada em 2026-05-24 para invalidar plan cache do pg_cron worker que chamava assinatura inexistente (60, 60).';
