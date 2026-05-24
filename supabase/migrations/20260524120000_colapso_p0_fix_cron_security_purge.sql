-- Migration: P0.1 — Recriar purge_expired_security_data para invalidar plan-cache do pg_cron worker
-- Contexto: o cron job "purge-expired-security" estava falhando 95/96 vezes/24h porque
-- o worker mantinha plano antigo chamando `purge_expired_step_up_artifacts(60, 60)`,
-- assinatura que não existe (a função real é sem args).
-- Aplicada em produção em 2026-05-24 pelo coordenador de TI Abner Silva.

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

  PERFORM 1;
END;
$function$;

COMMENT ON FUNCTION public.purge_expired_security_data() IS
'Limpeza periódica de artefatos de segurança. Recriada em 2026-05-24 para invalidar plan cache do pg_cron worker que chamava assinatura inexistente (60, 60).';
