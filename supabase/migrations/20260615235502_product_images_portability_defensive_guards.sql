-- ============================================================================
-- FIX (review Codex P2 #2 e #4): robustez/portabilidade dos migrations.
-- ----------------------------------------------------------------------------
-- #2: products.primary_image_fallback_url existe em prod (escrito pelo trigger de
--     sync), porém é "coluna fantasma" não criada por migration commitada -> em
--     rebuild fresco a partir dos migrations, fn_resync_product_media falharia com
--     "column does not exist". Garante a coluna de forma idempotente.
-- #4: VALIDATE CONSTRAINT do format (migration ..._format_canonical_guard) aborta se
--     houver valores legados (JPEG/jpg/mime) num DB construído do zero com dados
--     pré-existentes. Backfill canônico (no-op em prod, já 100% canônico) deixa o
--     estado consistente.
-- Idempotente e seguro (no-op em produção).
--
-- NOTA #3/#5 (Codex): NÃO aplicáveis a este schema — cloudflare_image_id é
-- UNIQUE + NOT NULL (desempate já determinístico) e url_cdn é NOT NULL com 0 linhas
-- vazias (sem risco de blank em primary_image_url).
-- ============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS primary_image_fallback_url text;

UPDATE public.product_images
SET format = CASE
      WHEN substring(regexp_replace(lower(format), '^.*/', '') from '[a-z0-9]+') = 'jpg'
        THEN 'jpeg'
      ELSE substring(regexp_replace(lower(format), '^.*/', '') from '[a-z0-9]+')
    END
WHERE format IS NOT NULL AND format !~ '^[a-z0-9]+$';
