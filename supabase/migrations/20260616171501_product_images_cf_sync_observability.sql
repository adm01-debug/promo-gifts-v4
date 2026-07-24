-- BLOCO 1/6 — Observabilidade de sincronizacao Cloudflare Images
-- Aditivo e idempotente. Nao remove/renomeia nada (CLAUDE.md REGRA #2 respeitada).
-- Aplicado em prod (doufsxqlfjyuvxuezpln) via MCP em 2026-06-16; este arquivo espelha o estado.

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS cf_sync_status    text        NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS cf_uploaded_at    timestamptz,
  ADD COLUMN IF NOT EXISTS cf_verified_at    timestamptz,
  ADD COLUMN IF NOT EXISTS cf_check_attempts smallint    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cf_last_error     text;

-- Coluna derivada (nao exige backfill nem trigger): classifica a convencao do ID.
ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS cf_id_scheme text GENERATED ALWAYS AS (
    CASE
      WHEN cloudflare_image_id ~ '^xbz_site_' THEN 'hash_legacy'
      WHEN cloudflare_image_id ~ '-dup-' OR cloudflare_image_id ~ '-leg-'
           OR cloudflare_image_id ~ '--ref' OR cloudflare_image_id ~ '-legacy$' THEN 'synthetic'
      WHEN cloudflare_image_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-' THEN 'uuid'
      WHEN cloudflare_image_id ~ '-(main|gal-[0-9]+)$' THEN 'main_gal'
      WHEN cloudflare_image_id ~ '-d[0-9]+$' THEN 'detail_dn'
      WHEN cloudflare_image_id ~ '-[0-9]{4,}-[0-9]{9,}$' OR cloudflare_image_id ~ 'd[0-9]+-[0-9]{9,}$' THEN 'slug_ts'
      WHEN cloudflare_image_id ~ '_[0-9]' THEN 'legacy_cor'
      ELSE 'seq'
    END
  ) STORED;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname='chk_pi_cf_sync_status' AND conrelid='public.product_images'::regclass) THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT chk_pi_cf_sync_status
      CHECK (cf_sync_status IN ('pending','uploading','uploaded','verified','missing','failed','orphaned'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pi_cf_sync_status
  ON public.product_images (cf_sync_status) WHERE cf_sync_status <> 'verified';

COMMENT ON COLUMN public.product_images.cf_sync_status    IS 'Estado do objeto no Cloudflare Images: pending|uploading|uploaded|verified|missing|failed|orphaned';
COMMENT ON COLUMN public.product_images.cf_uploaded_at    IS 'Timestamp do upload concluido no Cloudflare (campo uploaded da API CF)';
COMMENT ON COLUMN public.product_images.cf_verified_at    IS 'Ultima verificacao de existencia no CF (cf_images_check/batch_check)';
COMMENT ON COLUMN public.product_images.cf_check_attempts IS 'Numero de tentativas de verificacao/upload no CF';
COMMENT ON COLUMN public.product_images.cf_last_error     IS 'Ultima mensagem de erro de upload/verificacao no CF';
COMMENT ON COLUMN public.product_images.cf_id_scheme      IS 'Convencao do cloudflare_image_id (derivada): legacy_cor|detail_dn|main_gal|slug_ts|synthetic|hash_legacy|uuid|seq';
