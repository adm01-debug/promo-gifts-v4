CREATE TABLE IF NOT EXISTS public.crm_callback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_quote_id UUID NOT NULL,
  crm_quote_id UUID,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  result TEXT NOT NULL DEFAULT 'applied',
  error_message TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON public.crm_callback_events TO authenticated;
GRANT ALL ON public.crm_callback_events TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS ux_crm_callback_events_idempotency
  ON public.crm_callback_events (external_quote_id, event_type, occurred_at);
CREATE INDEX IF NOT EXISTS idx_crm_callback_events_quote_id
  ON public.crm_callback_events (external_quote_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_callback_events_type
  ON public.crm_callback_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_callback_events_error
  ON public.crm_callback_events (result, created_at DESC)
  WHERE result = 'error';

CREATE OR REPLACE FUNCTION public.set_crm_callback_events_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_callback_events_updated_at ON public.crm_callback_events;
CREATE TRIGGER trg_crm_callback_events_updated_at
  BEFORE UPDATE ON public.crm_callback_events
  FOR EACH ROW EXECUTE FUNCTION public.set_crm_callback_events_updated_at();

ALTER TABLE public.crm_callback_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins podem ver todos os callbacks CRM" ON public.crm_callback_events;
CREATE POLICY "Admins podem ver todos os callbacks CRM"
  ON public.crm_callback_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Sellers podem ver callbacks dos seus próprios orçamentos" ON public.crm_callback_events;
CREATE POLICY "Sellers podem ver callbacks dos seus próprios orçamentos"
  ON public.crm_callback_events
  FOR SELECT TO authenticated
  USING (
    external_quote_id IN (
      SELECT id FROM public.quotes
      WHERE seller_id = auth.uid()
    )
  );