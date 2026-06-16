-- BLOCO 3/6 — Linhagem R2 + origem do fornecedor
-- Aditivo e idempotente. Aplicado em prod via MCP em 2026-06-16.

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS r2_bucket         text,
  ADD COLUMN IF NOT EXISTS r2_object_key     text,
  ADD COLUMN IF NOT EXISTS source_fetched_at timestamptz;

COMMENT ON COLUMN public.product_images.r2_bucket         IS 'Bucket R2 do master/original (ex.: gift-store)';
COMMENT ON COLUMN public.product_images.r2_object_key     IS 'Chave (UUID) do objeto master no R2 — liga DB <-> R2';
COMMENT ON COLUMN public.product_images.source_fetched_at IS 'Quando a imagem de origem do fornecedor foi baixada pela ultima vez';
