-- Fix 1: Add contact_id to quotes table
-- The CRM contacts live in an EXTERNAL database (pgxfvjmuubtbowutlide),
-- so NO foreign-key constraint can be added here.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS contact_id UUID NULL;

COMMENT ON COLUMN public.quotes.contact_id IS
  'ID do contato no CRM externo (pgxfvjmuubtbowutlide). Sem FK — banco externo.';

-- Fix 2: Broken index from migration 20260525200101
-- That migration checked for column 'user_id' in quotes, but quotes uses 'seller_id'.
-- The count was always 2 (organization_id + status), never 3, so the index was never created.
-- This creates the correct composite index for RLS + listing queries (was causing 65k+ seq_scans).
CREATE INDEX IF NOT EXISTS idx_quotes_seller_org_status
  ON public.quotes(seller_id, organization_id, status);

-- Also index contact_id for future lookups by contact
CREATE INDEX IF NOT EXISTS idx_quotes_contact_id
  ON public.quotes(contact_id)
  WHERE contact_id IS NOT NULL;
