-- ==================================================================
-- MIGRATION: Auditoria completa módulo Novo Orçamento — 2026-06-23
-- Aplica todos os DDLs da sessão de auditoria para rastreabilidade
-- Todos já aplicados diretamente via Supabase MCP em 2026-06-22/23
-- ==================================================================

-- ─── DATA INTEGRITY ──────────────────────────────────────────────
-- FIX DATA-01: fn_expire_overdue_quotes e cronjob daily-expire-quotes
-- (aplicado em 2026-06-22; função e job já existem no banco)

CREATE OR REPLACE FUNCTION public.fn_expire_overdue_quotes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _expired_ids uuid[];
  _count integer;
  _fallback_uid uuid;
  rec RECORD;
BEGIN
  SELECT id INTO _fallback_uid FROM auth.users ORDER BY created_at LIMIT 1;

  SELECT array_agg(id) INTO _expired_ids
  FROM quotes
  WHERE valid_until < CURRENT_DATE
    AND status NOT IN ('expired', 'cancelled', 'converted', 'rejected', 'draft');

  IF _expired_ids IS NULL OR array_length(_expired_ids, 1) = 0 THEN
    RETURN jsonb_build_object('expired_count', 0, 'quote_ids', '[]'::jsonb);
  END IF;

  _count := array_length(_expired_ids, 1);

  INSERT INTO quote_history (
    quote_id, user_id, action, field_changed, old_value, new_value,
    description, metadata, created_at
  )
  SELECT
    q.id,
    COALESCE(q.seller_id, q.created_by, _fallback_uid),
    'status_change',
    'status',
    q.status,
    'expired',
    'Auto-expirado: valid_until ' || q.valid_until::text || ' anterior a ' || CURRENT_DATE::text,
    jsonb_build_object('auto_expired', true, 'valid_until', q.valid_until::text, 'previous_status', q.status),
    now()
  FROM quotes q
  WHERE q.id = ANY(_expired_ids);

  UPDATE quotes
  SET status = 'expired', updated_at = now()
  WHERE id = ANY(_expired_ids);

  RETURN jsonb_build_object(
    'expired_count', _count,
    'quote_ids', to_jsonb(_expired_ids),
    'executed_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.fn_expire_overdue_quotes IS
  'FIX DATA-01 (2026-06-22): Auto-expiração de orçamentos com valid_until < CURRENT_DATE.';

-- Cronjob: verificar se existe antes de criar
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-expire-quotes') THEN
    PERFORM cron.schedule(
      'daily-expire-quotes',
      '30 3 * * *',
      $sql$ SELECT public.fn_expire_overdue_quotes(); $sql$
    );
  END IF;
END $$;

-- ─── CHECK CONSTRAINTS ───────────────────────────────────────────
-- FIX-03: CHECKs de integridade monetária e enums
ALTER TABLE public.quotes
  ADD CONSTRAINT IF NOT EXISTS valid_total_nonnegative
  CHECK (total IS NULL OR total >= 0);

ALTER TABLE public.quotes
  ADD CONSTRAINT IF NOT EXISTS valid_subtotal_nonnegative
  CHECK (subtotal IS NULL OR subtotal >= 0);

ALTER TABLE public.quotes
  ADD CONSTRAINT IF NOT EXISTS valid_shipping_cost_nonnegative
  CHECK (shipping_cost IS NULL OR shipping_cost >= 0);

ALTER TABLE public.quotes
  ADD CONSTRAINT IF NOT EXISTS valid_shipping_type
  CHECK (shipping_type IS NULL OR shipping_type IN ('cif', 'fob', 'fob_pre'));

ALTER TABLE public.quotes
  ADD CONSTRAINT IF NOT EXISTS valid_real_discount_pct_max
  CHECK (real_discount_percent IS NULL OR real_discount_percent <= 100);

-- ─── PERFORMANCE INDEXES ─────────────────────────────────────────
-- FIX-04: Índices de performance ausentes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_quotes_client_id
  ON public.quotes USING btree (client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_valid_until
  ON public.quotes USING btree (valid_until)
  WHERE status NOT IN ('expired', 'cancelled', 'converted', 'rejected', 'draft');

CREATE INDEX IF NOT EXISTS idx_quotes_created_at_desc
  ON public.quotes USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quotes_client_name_trgm
  ON public.quotes USING gin (client_name gin_trgm_ops)
  WHERE client_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_quote_number_trgm
  ON public.quotes USING gin (quote_number gin_trgm_ops)
  WHERE quote_number IS NOT NULL AND quote_number <> '';

-- ─── WEBHOOK OUTBOX ASSÍNCRONO (QBP-05) ─────────────────────────
-- FIX-05: Tabela de outbox para dispatch assíncrono de webhooks
CREATE TABLE IF NOT EXISTS public.webhook_outbox (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event           text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'dead_letter')),
  attempts        integer NOT NULL DEFAULT 0,
  max_attempts    integer NOT NULL DEFAULT 3,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.webhook_outbox IS
  'FIX QBP-05 (2026-06-22): Outbox assíncrono para webhooks. '
  'Substitui http_post() síncrono no trigger dispatch_quote_webhook_event.';

CREATE INDEX IF NOT EXISTS idx_webhook_outbox_pending
  ON public.webhook_outbox (next_attempt_at)
  WHERE status IN (''pending'', ''processing'');

ALTER TABLE public.webhook_outbox ENABLE ROW LEVEL SECURITY;

-- Processar outbox: verificar antes de criar
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-webhook-outbox') THEN
    PERFORM cron.schedule(
      'process-webhook-outbox',
      '* * * * *',
      $sql$ SELECT public.fn_process_webhook_outbox_batch(); $sql$
    );
  END IF;
END $$;

-- ─── QBP-07/08/12: useQuoteBuilderState patches ──────────────────
-- Aplicados via commits TypeScript — ver:
-- commit 23bf1d1: quoteService.ts — _expected_version
-- commit b2044b6: useQuotes.ts — thread expectedVersion
-- ==================================================================
-- FIM DA MIGRATION
-- ==================================================================
