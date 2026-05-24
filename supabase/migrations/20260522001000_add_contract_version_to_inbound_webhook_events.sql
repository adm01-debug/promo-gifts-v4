-- contracts/05 — adiciona inbound_webhook_events.contract_version
--
-- Necessário para o handler `webhook-inbound` migrado em #45 conseguir gravar
-- a versão de contrato negociada (default '1' para compat).
--
-- Risco: baixo. ALTER TABLE com DEFAULT em coluna nova é metadata-only no PG12+.
-- A coluna recebe '1' automaticamente em todas as linhas existentes via DEFAULT,
-- sem rewrite da tabela.

BEGIN;

ALTER TABLE public.inbound_webhook_events
  ADD COLUMN IF NOT EXISTS contract_version text NOT NULL DEFAULT '1';

COMMENT ON COLUMN public.inbound_webhook_events.contract_version IS
  'Versão de contrato negociada via header accept-version. Default 1 (compat com payloads legados).';

-- Sanity check: deve existir após o ALTER
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inbound_webhook_events'
      AND column_name = 'contract_version'
  ) THEN
    RAISE EXCEPTION 'contracts/05 migration: contract_version column was not created';
  END IF;
END $$;

COMMIT;
