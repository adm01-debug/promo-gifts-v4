-- ═══════════════════════════════════════════════════════════════════════
-- IMP08 — Monitor diário de "dead letters" de callback do CRM
-- ═══════════════════════════════════════════════════════════════════════
-- Fonte: public.crm_callback_events (tabela real). Como v4_callback_dead_letters
-- e maintenance_log não existem neste banco, usamos:
--   • result='error' em janela de 24h como proxy de "não resolvido"
--   • RAISE WARNING para deixar rastro em cron.job_run_details.return_message
--     (evita criar tabela nova sem aprovação explícita do PO).
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_check_dead_letters(_window_hours integer DEFAULT 24)
RETURNS TABLE(unresolved_count bigint, alert text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count  BIGINT;
  v_alert  TEXT;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.crm_callback_events
  WHERE result = 'error'
    AND created_at >= now() - make_interval(hours => _window_hours);

  IF v_count > 0 THEN
    v_alert := format(
      '⚠️  %s callback(s) do CRM com result=error nas últimas %s h — investigar em crm_callback_events.',
      v_count, _window_hours
    );
    -- WARNING é capturado em cron.job_run_details.return_message
    RAISE WARNING '[dead-letters-check] %', v_alert;
  ELSE
    v_alert := '✅ Nenhum callback com result=error na janela.';
    RAISE NOTICE '[dead-letters-check] %', v_alert;
  END IF;

  RETURN QUERY SELECT v_count, v_alert;
END;
$$;

COMMENT ON FUNCTION public.fn_check_dead_letters(integer) IS
  'IMP08: conta callbacks do CRM com result=error na janela (default 24h) e emite WARNING no pg_cron quando houver pendências. Executada diariamente pelo job check-dead-letters-daily.';

-- ACL: só service_role executa. Sem PUBLIC/anon/authenticated.
REVOKE ALL ON FUNCTION public.fn_check_dead_letters(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_check_dead_letters(integer) FROM anon;
REVOKE ALL ON FUNCTION public.fn_check_dead_letters(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_check_dead_letters(integer) TO service_role;

-- Remove agendamento anterior (idempotência da migration)
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'check-dead-letters-daily';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

-- Agenda: todo dia às 08:00 UTC (05:00 America/Sao_Paulo)
SELECT cron.schedule(
  'check-dead-letters-daily',
  '0 8 * * *',
  $cron$ SELECT * FROM public.fn_check_dead_letters(24); $cron$
);