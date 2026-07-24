-- Contract versioning for webhooks/Edge Functions.
--
-- Adds `contract_version` to the tables that record per-call metadata for
-- the three webhook-shaped endpoints (`product-webhook`,
-- `inbound_webhook_endpoints`, `outbound_webhooks`). Default `'v1'` so
-- existing rows / unset clients keep working unchanged.
--
-- Also adds `contract_schema jsonb` to `inbound_webhook_endpoints` so the
-- admin can register per-slug payload schemas without redeploying the
-- function. The schema is consulted by `webhook-inbound` after the HMAC
-- check; an unknown / missing schema falls back to "accept any JSON object"
-- (current behavior).
--
-- All operations are additive — no breaking change.

DO $$
BEGIN
  -- product_sync_logs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_sync_logs') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'product_sync_logs' AND column_name = 'contract_version'
    ) THEN
      ALTER TABLE public.product_sync_logs
        ADD COLUMN contract_version text NOT NULL DEFAULT 'v1';
      COMMENT ON COLUMN public.product_sync_logs.contract_version IS
        'Wire contract version posted by the client (v1 legacy / v2 with currency+selectors). Used to track v1 deprecation.';
    END IF;
  END IF;

  -- inbound_webhook_endpoints
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inbound_webhook_endpoints') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'inbound_webhook_endpoints' AND column_name = 'contract_version'
    ) THEN
      ALTER TABLE public.inbound_webhook_endpoints
        ADD COLUMN contract_version text NOT NULL DEFAULT 'v1';
      COMMENT ON COLUMN public.inbound_webhook_endpoints.contract_version IS
        'Per-slug contract version expected by this endpoint. Admin promotes v1 → v2 by updating this row + contract_schema.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'inbound_webhook_endpoints' AND column_name = 'contract_schema'
    ) THEN
      ALTER TABLE public.inbound_webhook_endpoints
        ADD COLUMN contract_schema jsonb;
      COMMENT ON COLUMN public.inbound_webhook_endpoints.contract_schema IS
        'Optional JSON-schema-like Zod-compatible shape. If present, webhook-inbound validates the payload against it after HMAC verification.';
    END IF;
  END IF;

  -- outbound_webhooks (powering webhook-dispatcher)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'outbound_webhooks') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'outbound_webhooks' AND column_name = 'contract_version'
    ) THEN
      ALTER TABLE public.outbound_webhooks
        ADD COLUMN contract_version text NOT NULL DEFAULT 'v1';
      COMMENT ON COLUMN public.outbound_webhooks.contract_version IS
        'Wire contract version this outbound webhook expects. Sent as X-Contract-Version header + version field on every dispatch.';
    END IF;
  END IF;
END
$$;
