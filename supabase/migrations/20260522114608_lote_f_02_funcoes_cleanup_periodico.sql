-- LOTE F 2/4 - cleanup functions
CREATE OR REPLACE FUNCTION public.cleanup_security_logs()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _tf int:=0; _bl int:=0; _al int:=0; _ip int:=0;
BEGIN
  WITH d AS (DELETE FROM public.public_token_failures WHERE created_at < now()-interval '90 days' RETURNING 1) SELECT count(*) INTO _tf FROM d;
  WITH d AS (DELETE FROM public.bot_detection_log WHERE created_at < now()-interval '90 days' RETURNING 1) SELECT count(*) INTO _bl FROM d;
  WITH d AS (DELETE FROM public.admin_audit_log WHERE created_at < now()-interval '365 days' RETURNING 1) SELECT count(*) INTO _al FROM d;
  WITH d AS (DELETE FROM public.ip_access_control WHERE expires_at IS NOT NULL AND expires_at < now()-interval '30 days' RETURNING 1) SELECT count(*) INTO _ip FROM d;
  RETURN jsonb_build_object('ok',true,'ran_at',now(),'public_token_failures_deleted',_tf,'bot_detection_log_deleted',_bl,'admin_audit_log_deleted',_al,'ip_access_control_expired_deleted',_ip);
END; $$;
REVOKE EXECUTE ON FUNCTION public.cleanup_security_logs() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.purge_expired_security_data()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.purge_expired_step_up_artifacts(60,60);
  DELETE FROM public.login_attempts WHERE created_at < now()-interval '90 days';
END; $$;
REVOKE EXECUTE ON FUNCTION public.purge_expired_security_data() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cleanup_old_telemetry()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN DELETE FROM public.frontend_telemetry WHERE created_at < now()-interval '15 days'; RETURN NEW; END; $$;
