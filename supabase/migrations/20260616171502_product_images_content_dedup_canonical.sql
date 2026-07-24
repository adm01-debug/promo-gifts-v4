-- BLOCO 2/6 — Deduplicacao por conteudo + canonicalizacao
-- Aditivo e idempotente. Aplicado em prod via MCP em 2026-06-16.

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS content_hash       text,
  ADD COLUMN IF NOT EXISTS canonical_image_id uuid,
  ADD COLUMN IF NOT EXISTS is_shared          boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname='product_images_canonical_image_id_fkey' AND conrelid='public.product_images'::regclass) THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT product_images_canonical_image_id_fkey
      FOREIGN KEY (canonical_image_id) REFERENCES public.product_images(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname='chk_pi_canonical_not_self' AND conrelid='public.product_images'::regclass) THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT chk_pi_canonical_not_self CHECK (canonical_image_id IS NULL OR canonical_image_id <> id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pi_content_hash ON public.product_images (content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pi_canonical    ON public.product_images (canonical_image_id) WHERE canonical_image_id IS NOT NULL;

COMMENT ON COLUMN public.product_images.content_hash       IS 'Hash do binario (sha256) ou etag R2/CF para deduplicacao de conteudo';
COMMENT ON COLUMN public.product_images.canonical_image_id IS 'Aponta para a linha canonica quando esta e alias/duplicata (substitui o hack -dup-)';
COMMENT ON COLUMN public.product_images.is_shared          IS 'TRUE quando a imagem fisica e compartilhada por multiplos produtos';
