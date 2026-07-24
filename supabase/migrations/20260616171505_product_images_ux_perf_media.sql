-- BLOCO 5/6 — UX / performance / acesso
-- Aditivo e idempotente. Aplicado em prod via MCP em 2026-06-16.
-- Nota: aspect_ratio e GENERATED STORED (reescrita unica da tabela ao aplicar).

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS blurhash            text,
  ADD COLUMN IF NOT EXISTS requires_signed_url boolean NOT NULL DEFAULT false;

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS aspect_ratio numeric GENERATED ALWAYS AS (
    CASE WHEN height_px IS NOT NULL AND height_px > 0 AND width_px IS NOT NULL
         THEN round(width_px::numeric / height_px::numeric, 4) END
  ) STORED;

COMMENT ON COLUMN public.product_images.blurhash            IS 'Placeholder LQIP/blurhash para blur-up (evita layout shift)';
COMMENT ON COLUMN public.product_images.requires_signed_url IS 'Espelha requireSignedURLs do Cloudflare (imagem privada)';
COMMENT ON COLUMN public.product_images.aspect_ratio        IS 'Razao de aspecto (derivada): width_px/height_px arredondada a 4 casas';
