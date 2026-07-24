-- Migration: inbound webhook infra para receber quote.sent do PromoGifts
-- Rodar no projeto Promo Champions (rapjswienfhkobhlamxb) via MCP apply_migration.

-- ============================================================
-- 1) Mirror mínimo dos orçamentos recebidos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quotes_inbound (
  quote_id       uuid PRIMARY KEY,
  quote_number   text,
  status         text,
  client_id      text,
  client_name    text,
  total          numeric(14,2),
  seller_email   text,
  source_updated_at timestamptz,
  raw_payload    jsonb NOT NULL,
  received_at    timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.quotes_inbound TO authenticated;
GRANT ALL    ON public.quotes_inbound TO service_role;

ALTER TABLE public.quotes_inbound ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes_inbound_service_all"
  ON public.quotes_inbound
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "quotes_inbound_authenticated_read"
  ON public.quotes_inbound
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 2) Dedupe por correlation_key (TTL 30d via cron opcional)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webhook_inbound_dedupe (
  correlation_key text PRIMARY KEY,
  event           text NOT NULL,
  source          text NOT NULL DEFAULT 'promogifts',
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  hit_count       integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS webhook_inbound_dedupe_first_seen_idx
  ON public.webhook_inbound_dedupe (first_seen_at);

GRANT SELECT ON public.webhook_inbound_dedupe TO authenticated;
GRANT ALL    ON public.webhook_inbound_dedupe TO service_role;

ALTER TABLE public.webhook_inbound_dedupe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_inbound_dedupe_service_all"
  ON public.webhook_inbound_dedupe
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- 3) Log de auditoria (toda chamada, ok ou não)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webhook_inbound_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at     timestamptz NOT NULL DEFAULT now(),
  source          text NOT NULL DEFAULT 'promogifts',
  event           text,
  correlation_key text,
  outcome         text NOT NULL, -- ok | duplicate_ignored | hmac_missing | hmac_mismatch | invalid_payload | internal_error
  http_status     integer NOT NULL,
  request_id      text,
  error_message   text,
  payload_size    integer
);

CREATE INDEX IF NOT EXISTS webhook_inbound_log_received_idx
  ON public.webhook_inbound_log (received_at DESC);
CREATE INDEX IF NOT EXISTS webhook_inbound_log_outcome_idx
  ON public.webhook_inbound_log (outcome, received_at DESC);

GRANT SELECT ON public.webhook_inbound_log TO authenticated;
GRANT ALL    ON public.webhook_inbound_log TO service_role;

ALTER TABLE public.webhook_inbound_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_inbound_log_service_all"
  ON public.webhook_inbound_log
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "webhook_inbound_log_authenticated_read"
  ON public.webhook_inbound_log
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 4) Trigger de updated_at para quotes_inbound
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotes_inbound_updated_at ON public.quotes_inbound;
CREATE TRIGGER quotes_inbound_updated_at
  BEFORE UPDATE ON public.quotes_inbound
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
