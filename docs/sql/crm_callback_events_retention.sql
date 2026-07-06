-- ============================================================================
-- CRM Callback Events — Retenção + Índices de Observabilidade
-- Aplicar no banco canônico: doufsxqlfjyuvxuezpln
-- Idempotente: pode ser reexecutado.
-- ============================================================================

-- 1) Índices de leitura (troubleshooting no Log Explorer + dashboards)
CREATE INDEX IF NOT EXISTS idx_crm_callback_events_external_quote
  ON public.crm_callback_events (external_quote_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_callback_events_event_type_time
  ON public.crm_callback_events (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_callback_events_result_time
  ON public.crm_callback_events (result, created_at DESC)
  WHERE result <> 'applied';

-- 2) Retenção: apaga eventos com mais de 180 dias.
--    Mantém 6 meses de histórico para auditoria/BI e evita bloat.
CREATE OR REPLACE FUNCTION public.purge_old_crm_callback_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.crm_callback_events
  WHERE created_at < now() - interval '180 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_crm_callback_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_crm_callback_events() TO service_role;

-- 3) Agendamento diário via pg_cron (03:17 UTC, fora do pico BR).
--    Requer extensão pg_cron habilitada no projeto canônico.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('purge_old_crm_callback_events')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge_old_crm_callback_events');
    PERFORM cron.schedule(
      'purge_old_crm_callback_events',
      '17 3 * * *',
      $cron$SELECT public.purge_old_crm_callback_events();$cron$
    );
  END IF;
END $$;

-- 4) View de saúde (opcional, útil no admin/telemetria)
CREATE OR REPLACE VIEW public.v_crm_callback_health AS
SELECT
  date_trunc('hour', created_at)         AS bucket,
  event_type,
  result,
  count(*)                               AS total
FROM public.crm_callback_events
WHERE created_at >= now() - interval '7 days'
GROUP BY 1, 2, 3
ORDER BY 1 DESC;

REVOKE ALL ON public.v_crm_callback_health FROM PUBLIC, anon;
GRANT SELECT ON public.v_crm_callback_health TO authenticated, service_role;
