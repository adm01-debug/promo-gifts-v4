
-- ════════════════════════════════════════════════════════════════
-- FASE 2 — content_hash GERADO pelo banco (idempotência confiável)
-- jsonb::text é canônico no PG → hash determinístico, nunca nulo,
-- independe do n8n. Resolve os 92% de raw_hash nulos de forma estrutural.
-- ════════════════════════════════════════════════════════════════
ALTER TABLE public.supplier_products_raw
  ADD COLUMN IF NOT EXISTS content_hash text
  GENERATED ALWAYS AS (encode(extensions.digest(raw_data::text, 'sha256'), 'hex')) STORED;
