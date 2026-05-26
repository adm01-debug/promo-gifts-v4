-- Update inbound_webhook_events table
ALTER TABLE public.inbound_webhook_events 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
ADD COLUMN IF NOT EXISTS contract_version TEXT;

-- Create a unique index for idempotency
-- We use a conditional index because idempotency_key might be null for some webhooks
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_idempotency 
ON public.inbound_webhook_events (endpoint_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Ensure RLS is correct for logging and access
GRANT SELECT, INSERT, UPDATE ON public.inbound_webhook_events TO authenticated, service_role;
GRANT SELECT ON public.inbound_webhook_events TO anon;
