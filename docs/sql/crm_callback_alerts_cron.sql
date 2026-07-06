-- ============================================================================
-- CRM Callback Alerts — Configuração + Cron
-- Aplicar no banco canônico: doufsxqlfjyuvxuezpln
-- ============================================================================

-- 1) Chave de configuração dos limiares (editável via /admin/settings)
INSERT INTO public.system_settings (key, value, description, updated_at)
VALUES (
  'crm_callback_alerts',
  jsonb_build_object(
    'window_minutes',      5,
    'min_events',          5,
    'failure_pct_warn',    20,
    'failure_pct_error',   40,
    'exhausted_abs_error', 3
  ),
  'Limiares de alerta para crm-callback-alerts (varredura por janela).',
  now()
)
ON CONFLICT (key) DO NOTHING;

-- 2) Agendar cron 1x/min chamando a edge function via pg_net (padrão do projeto).
--    Requer pg_cron + pg_net habilitados.
DO $$
DECLARE
  v_service_role_key text;
  v_project_url      text := 'https://doufsxqlfjyuvxuezpln.functions.supabase.co';
BEGIN
  -- Recuperar service role de vault (padrão do projeto). Ajuste conforme SSOT.
  SELECT decrypted_secret INTO v_service_role_key
    FROM vault.decrypted_secrets
   WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
   LIMIT 1;

  IF v_service_role_key IS NULL THEN
    RAISE NOTICE 'SUPABASE_SERVICE_ROLE_KEY não encontrada no vault — agendamento manual necessário.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('crm_callback_alerts')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'crm_callback_alerts');
    PERFORM cron.schedule(
      'crm_callback_alerts',
      '*/1 * * * *',
      format($cron$
        SELECT net.http_post(
          url     := %L,
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || %L
          ),
          body    := '{}'::jsonb
        );
      $cron$, v_project_url || '/crm-callback-alerts', v_service_role_key)
    );
  END IF;
END $$;
