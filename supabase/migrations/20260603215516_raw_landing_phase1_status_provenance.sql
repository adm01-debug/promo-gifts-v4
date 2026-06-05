
-- ════════════════════════════════════════════════════════════════
-- FASE 1 — Máquina de estados + proveniência + backfill (ADITIVO)
-- Landing bronze multi-fornecedor. Nada destrutivo aqui.
-- ════════════════════════════════════════════════════════════════

-- Estado de processamento como enum (substitui semanticamente o boolean)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='supplier_raw_status') THEN
    CREATE TYPE supplier_raw_status AS ENUM
      ('pending','processing','processed','failed','skipped','quarantined');
  END IF;
END $$;

-- Colunas novas. status/images_status já nascem NOT NULL DEFAULT 'pending'
-- (seguro: o DEFAULT preenche as linhas existentes; o backfill abaixo corrige).
-- source_channel nasce 'legacy' para as linhas históricas; depois vira 'n8n' para novos inserts.
ALTER TABLE public.supplier_products_raw
  ADD COLUMN IF NOT EXISTS source_channel  text    NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS source_event_id text,
  ADD COLUMN IF NOT EXISTS source_endpoint text,
  ADD COLUMN IF NOT EXISTS attempts        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS claimed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS last_error      jsonb,
  ADD COLUMN IF NOT EXISTS status          supplier_raw_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS images_status   supplier_raw_status NOT NULL DEFAULT 'pending';

-- Backfill pela VERDADE OBSERVÁVEL: product_id materializado = processed.
-- Warnings (process_errors) de quem já materializou viram last_error informativo, sem rebaixar o status.
UPDATE public.supplier_products_raw SET
  status = CASE
    WHEN product_id IS NOT NULL     THEN 'processed'
    WHEN process_errors IS NOT NULL THEN 'failed'
    WHEN processed                  THEN 'processed'
    ELSE 'pending' END::supplier_raw_status,
  images_status = CASE WHEN images_processed THEN 'processed' ELSE 'pending' END::supplier_raw_status,
  last_error = COALESCE(last_error, process_errors);

-- A partir de agora, novos inserts default = 'n8n' (histórico permanece 'legacy')
ALTER TABLE public.supplier_products_raw ALTER COLUMN source_channel SET DEFAULT 'n8n';
