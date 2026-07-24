-- Fix broken security purge cron (job: purge-expired-security, every 15 min).
--
-- purge_expired_security_data() called purge_expired_step_up_artifacts(60, 60),
-- but that function exists only with a zero-argument signature. The call aborted
-- on the first statement (96 failures/24h, 0 successes), so expired step-up
-- artifacts were never purged and old login_attempts were never cleaned.
--
-- Fix: call the existing zero-argument signature.

CREATE OR REPLACE FUNCTION public.purge_expired_security_data()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Limpa artefatos de step-up via helper existente (assinatura sem argumentos)
  PERFORM public.purge_expired_step_up_artifacts();

  -- Limpa tentativas de login antigas (90 dias)
  DELETE FROM public.login_attempts WHERE created_at < now() - interval '90 days';
END;
$function$;
