-- BLOCO 4/6 — Governanca / proveniencia de escrita
-- Aditivo e idempotente. Aplicado em prod via MCP em 2026-06-16.

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS import_batch_id      uuid,
  ADD COLUMN IF NOT EXISTS last_modified_source text,
  ADD COLUMN IF NOT EXISTS deleted_at           timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_reason       text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname='chk_pi_last_modified_source' AND conrelid='public.product_images'::regclass) THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT chk_pi_last_modified_source
      CHECK (last_modified_source IS NULL OR last_modified_source IN
            ('pipeline','manual','lovable','claude','migration','n8n','edge_function','api'));
  END IF;
END $$;

COMMENT ON COLUMN public.product_images.import_batch_id      IS 'ID do lote de ingestao que criou/atualizou a linha (rastreabilidade)';
COMMENT ON COLUMN public.product_images.last_modified_source IS 'Origem da ultima escrita: pipeline|manual|lovable|claude|migration|n8n|edge_function|api';
COMMENT ON COLUMN public.product_images.deleted_at           IS 'Soft-delete com carimbo (complementa is_active)';
COMMENT ON COLUMN public.product_images.deleted_reason       IS 'Motivo do soft-delete';
