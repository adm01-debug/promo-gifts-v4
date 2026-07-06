-- =========================================================================
-- Migration DRAFT: crm_callback_events
-- Data: 2026-07-06
-- Alvo: Supabase CANÔNICO `doufsxqlfjyuvxuezpln` (Gestão de Produtos / Gold)
-- Aplicar via: `supabase db push --project-ref doufsxqlfjyuvxuezpln`
--              (o dono do projeto promove este arquivo para
--              supabase/migrations/ e roda o push).
--
-- Objetivo: tabela de auditoria/idempotência para callbacks do CRM
--           (Promo Champions V2) recebidos pela edge function
--           `receive-crm-callback`.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.crm_callback_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_quote_id uuid NOT NULL,
  crm_quote_id      uuid,
  event_type        text NOT NULL,
  occurred_at       timestamptz NOT NULL,
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  result            text NOT NULL,      -- 'applied' | 'duplicate_ignored' | 'error'
  error_message     text,
  received_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT crm_callback_events_event_type_chk
    CHECK (event_type IN ('approved','rejected','order_created','sent_to_client','expired')),
  CONSTRAINT crm_callback_events_result_chk
    CHECK (result IN ('applied','duplicate_ignored','error')),
  CONSTRAINT crm_callback_events_idempotency_uk
    UNIQUE (external_quote_id, event_type, occurred_at)
);

COMMENT ON TABLE public.crm_callback_events IS
  'Auditoria + chave de idempotência dos callbacks recebidos do CRM Promo Champions V2 via edge function receive-crm-callback.';

-- GRANTs (obrigatório em public — Data API não concede por padrão)
GRANT SELECT ON public.crm_callback_events TO authenticated;
GRANT ALL    ON public.crm_callback_events TO service_role;

-- RLS: admins visualizam; escrita só via service_role (edge function).
ALTER TABLE public.crm_callback_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view crm callback events" ON public.crm_callback_events;
CREATE POLICY "Admins can view crm callback events"
  ON public.crm_callback_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Índices de consulta
CREATE INDEX IF NOT EXISTS idx_crm_callback_events_quote
  ON public.crm_callback_events (external_quote_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_callback_events_result_received
  ON public.crm_callback_events (result, received_at DESC);
