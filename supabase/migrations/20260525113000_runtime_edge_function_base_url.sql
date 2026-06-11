-- ============================================================================
-- Runtime-configured Edge Function base URL for SQL callers (cron/triggers/RPC)
-- ----------------------------------------------------------------------------
-- Objetivo:
-- - Remover dependência de URLs hardcoded em migrations históricas.
-- - Permitir promoção dev/stage/prod sem editar migration antiga.
-- - Centralizar resolução da base URL em runtime por GUC + Vault.
--
-- Precedência de resolução:
-- 1) current_setting('app.edge_functions_base_url', true)
-- 2) vault secret EDGE_FUNCTIONS_BASE_URL
-- 3) erro explícito (fail-closed)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_edge_functions_base_url()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $function$
DECLARE
  _cfg text;
  _vault text;
BEGIN
  _cfg := NULLIF(current_setting('app.edge_functions_base_url', true), '');

  IF _cfg IS NOT NULL THEN
    IF _cfg ~ '^https://[a-z0-9-]+\.supabase\.co$' THEN
      RETURN _cfg;
    END IF;

    RAISE EXCEPTION 'app.edge_functions_base_url invalido: %', _cfg
      USING ERRCODE = '22023';
  END IF;

  SELECT decrypted_secret INTO _vault
  FROM vault.decrypted_secrets
  WHERE name = 'EDGE_FUNCTIONS_BASE_URL'
  LIMIT 1;

  IF _vault IS NOT NULL THEN
    IF _vault ~ '^https://[a-z0-9-]+\.supabase\.co$' THEN
      RETURN _vault;
    END IF;

    RAISE EXCEPTION 'Secret EDGE_FUNCTIONS_BASE_URL invalido no vault: %', _vault
      USING ERRCODE = '22023';
  END IF;

  RAISE EXCEPTION 'Base URL das Edge Functions nao configurada. Defina app.edge_functions_base_url ou secret EDGE_FUNCTIONS_BASE_URL.'
    USING ERRCODE = 'no_data_found';
END;
$function$;

REVOKE ALL ON FUNCTION public.get_edge_functions_base_url() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_edge_functions_base_url() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_edge_functions_base_url() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_edge_functions_base_url() TO postgres;

COMMENT ON FUNCTION public.get_edge_functions_base_url() IS
  'Resolve base URL das Edge Functions via current_setting(app.edge_functions_base_url) e fallback para vault EDGE_FUNCTIONS_BASE_URL.';

-- Recria trigger caller com URL dinâmica.
CREATE OR REPLACE FUNCTION public.dispatch_quote_webhook_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  _event text;
  _payload jsonb;
  _project_url text;
  _dispatcher_secret text;
BEGIN
  _project_url := public.get_edge_functions_base_url();

  IF TG_TABLE_NAME = 'quotes' THEN
    IF TG_OP = 'INSERT' THEN _event := 'quote.created';
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN _event := 'quote.' || NEW.status;
    ELSE RETURN NEW; END IF;
    _payload := jsonb_build_object('id', NEW.id, 'quote_number', NEW.quote_number, 'status', NEW.status,
      'client_name', NEW.client_name, 'client_email', NEW.client_email, 'total', NEW.total,
      'seller_id', NEW.seller_id, 'updated_at', NEW.updated_at);
  ELSIF TG_TABLE_NAME = 'orders' THEN
    IF TG_OP = 'INSERT' THEN _event := 'order.created'; ELSE RETURN NEW; END IF;
    _payload := jsonb_build_object('id', NEW.id, 'order_number', NEW.order_number, 'status', NEW.status,
      'client_name', NEW.client_name, 'total', NEW.total, 'seller_id', NEW.seller_id);
  ELSIF TG_TABLE_NAME = 'discount_approval_requests' THEN
    IF TG_OP = 'INSERT' THEN _event := 'discount.requested';
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved','rejected') THEN _event := 'discount.' || NEW.status;
    ELSE RETURN NEW; END IF;
    _payload := jsonb_build_object('id', NEW.id, 'quote_id', NEW.quote_id,
      'requested_discount_percent', NEW.requested_discount_percent, 'status', NEW.status, 'seller_id', NEW.seller_id);
  ELSE RETURN NEW; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.outbound_webhooks WHERE active = true AND _event = ANY(events)) THEN
    RETURN NEW;
  END IF;

  BEGIN
    _dispatcher_secret := public.get_edge_function_secret('WEBHOOK_DISPATCHER_SECRET');
  EXCEPTION WHEN OTHERS THEN
    _dispatcher_secret := NULL;
  END;

  PERFORM extensions.http_post(
    url := _project_url || '/functions/v1/webhook-dispatcher',
    body := jsonb_build_object('event', _event, 'payload', _payload)::text,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatcher-secret', COALESCE(_dispatcher_secret, '')
    ),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

-- Recria RPC caller com URL dinâmica.
CREATE OR REPLACE FUNCTION public.retry_failed_webhook_deliveries()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_supabase_url text;
  v_service_key text;
  v_dispatcher_secret text;
  v_retried int := 0;
  v_skipped int := 0;
  rec record;
  v_max_attempts int;
BEGIN
  v_supabase_url := public.get_edge_functions_base_url();

  BEGIN
    v_service_key := current_setting('app.supabase_service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    v_service_key := NULL;
  END;

  BEGIN
    v_dispatcher_secret := public.get_edge_function_secret('WEBHOOK_DISPATCHER_SECRET');
  EXCEPTION WHEN OTHERS THEN
    v_dispatcher_secret := NULL;
  END;

  IF v_dispatcher_secret IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'WEBHOOK_DISPATCHER_SECRET not configured in vault');
  END IF;

  FOR rec IN
    WITH latest AS (
      SELECT DISTINCT ON (d.webhook_id, d.event, d.payload_hash)
        d.id, d.webhook_id, d.event, d.payload, d.attempt, d.success
      FROM public.webhook_deliveries d
      WHERE d.delivered_at > now() - interval '1 hour'
      ORDER BY d.webhook_id, d.event, d.payload_hash, d.attempt DESC
    )
    SELECT l.*, w.active, w.retry_policy
    FROM latest l
    JOIN public.outbound_webhooks w ON w.id = l.webhook_id
    WHERE l.success = false AND w.active = true
  LOOP
    v_max_attempts := COALESCE((rec.retry_policy->>'max_attempts')::int, 3);

    IF rec.attempt >= v_max_attempts THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/webhook-dispatcher',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-dispatcher-secret', v_dispatcher_secret,
        'Authorization', COALESCE('Bearer ' || v_service_key, '')
      ),
      body := jsonb_build_object('event', rec.event, 'payload', rec.payload)
    );
    v_retried := v_retried + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'retried', v_retried, 'skipped_max_attempts', v_skipped, 'ran_at', now());
END;
$function$;

-- Reschedule cron callers com URL dinâmica.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'connections-auto-test') THEN
    PERFORM cron.unschedule('connections-auto-test');
  END IF;
END $$;

SELECT cron.schedule(
  'connections-auto-test',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := public.get_edge_functions_base_url() || '/functions/v1/connections-auto-test',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.get_edge_function_secret('CONNECTIONS_AUTO_TEST_SECRET')
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $cron$
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'external-db-bridge-keepalive') THEN
    PERFORM cron.unschedule('external-db-bridge-keepalive');

    PERFORM cron.schedule(
      'external-db-bridge-keepalive',
      '*/4 * * * *',
      $cron$
      SELECT net.http_post(
        url := public.get_edge_functions_base_url() || '/functions/v1/external-db-bridge',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{"operation":"ping"}'::jsonb,
        timeout_milliseconds := 5000
      ) AS request_id;
      $cron$
    );
  END IF;
END $$;

-- Validação operacional: endpoint esperado por ambiente sem editar migration histórica.
CREATE OR REPLACE FUNCTION public.validate_edge_functions_base_url(_environment text)
RETURNS TABLE(ok boolean, resolved_url text, expected_pattern text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _url text;
  _pattern text;
BEGIN
  _url := public.get_edge_functions_base_url();

  _pattern := CASE lower(coalesce(_environment, ''))
    WHEN 'prod' THEN '^https://pqpdolkaeqlyzpdpbizo\.supabase\.co$'
    WHEN 'stage' THEN '^https://[a-z0-9-]+\.supabase\.co$'
    WHEN 'dev' THEN '^https://[a-z0-9-]+\.supabase\.co$'
    ELSE '^https://[a-z0-9-]+\.supabase\.co$'
  END;

  RETURN QUERY SELECT (_url ~ _pattern), _url, _pattern;
END;
$function$;
