-- ============================================================================
-- Edge Function Secrets — Atualiza Chamadores
-- ----------------------------------------------------------------------------
-- ORIGEM: Aplicado via MCP `apply_migration` em 2026-05-14 11:20 UTC.
-- ESTE ARQUIVO É SNAPSHOT (ADR 0006).
--
-- Atualiza TODOS os chamadores SQL das edge functions `webhook-dispatcher`
-- e `connections-auto-test` para incluir o header de autenticação.
--
-- Chamadores atualizados:
-- 1) Helper `public.get_edge_function_secret` (lê vault, SECURITY DEFINER)
-- 2) Trigger function `dispatch_quote_webhook_event`
-- 3) RPC `retry_failed_webhook_deliveries`
-- 4) Cron job `connections-auto-test`
--
-- Ordem importa: esta migration foi aplicada ANTES do deploy das edge
-- functions com a validação. Edge function antiga ignora headers extras.
-- ============================================================================

-- Helper SECURITY DEFINER para ler secret do vault.
-- Restringido a service_role + postgres roles via REVOKE/GRANT.
CREATE OR REPLACE FUNCTION public.get_edge_function_secret(_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public, pg_temp
AS $function$
DECLARE
  _secret text;
BEGIN
  IF _name NOT IN ('WEBHOOK_DISPATCHER_SECRET', 'CONNECTIONS_AUTO_TEST_SECRET') THEN
    RAISE EXCEPTION 'Nome de secret nao autorizado: %', _name USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT decrypted_secret INTO _secret
  FROM vault.decrypted_secrets
  WHERE name = _name
  LIMIT 1;

  IF _secret IS NULL THEN
    RAISE EXCEPTION 'Secret % nao encontrado no vault', _name USING ERRCODE = 'no_data_found';
  END IF;

  RETURN _secret;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_edge_function_secret(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_edge_function_secret(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_edge_function_secret(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_edge_function_secret(text) TO postgres;

COMMENT ON FUNCTION public.get_edge_function_secret(text) IS
  'Le secret de vault.decrypted_secrets. SECURITY DEFINER. Restrito a 2 nomes whitelisted. Usado por triggers/cron/RPCs que chamam edge functions com auth via header.';

-- ============================================================================
-- 1) Trigger function: dispatch_quote_webhook_event
-- ============================================================================
CREATE OR REPLACE FUNCTION public.dispatch_quote_webhook_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  _event text;
  _payload jsonb;
  _project_url text := 'https://pqpdolkaeqlyzpdpbizo.supabase.co';
  _dispatcher_secret text;
BEGIN
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

-- ============================================================================
-- 2) RPC: retry_failed_webhook_deliveries
-- ============================================================================
CREATE OR REPLACE FUNCTION public.retry_failed_webhook_deliveries()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_supabase_url text := 'https://pqpdolkaeqlyzpdpbizo.supabase.co';
  v_service_key text;
  v_dispatcher_secret text;
  v_retried int := 0;
  v_skipped int := 0;
  rec record;
  v_max_attempts int;
BEGIN
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
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'WEBHOOK_DISPATCHER_SECRET not configured in vault'
    );
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
      body := jsonb_build_object(
        'event', rec.event,
        'payload', rec.payload
      )
    );
    v_retried := v_retried + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'retried', v_retried,
    'skipped_max_attempts', v_skipped,
    'ran_at', now()
  );
END;
$function$;

-- ============================================================================
-- 3) Cron: connections-auto-test
-- ============================================================================
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
    url := 'https://pqpdolkaeqlyzpdpbizo.supabase.co/functions/v1/connections-auto-test',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.get_edge_function_secret('CONNECTIONS_AUTO_TEST_SECRET')
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $cron$
);
