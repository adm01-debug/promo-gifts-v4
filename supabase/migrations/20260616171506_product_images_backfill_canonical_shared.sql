-- BLOCO 6/6 — Backfill deterministico: canonicaliza linhas alias e marca canonicas compartilhadas
-- Idempotente (IS DISTINCT FROM evita reescritas em re-execucao). Escopo: ~593 aliases.
-- Aplicado em prod via MCP em 2026-06-16. Resultado: 593 canonicalizadas, 579 canonicas is_shared.

UPDATE public.product_images a
SET canonical_image_id = c.id
FROM public.product_images c
WHERE a.url_cdn NOT LIKE '%/' || a.cloudflare_image_id || '/%'
  AND c.cloudflare_image_id = split_part(a.url_cdn, '/', 5)
  AND c.id <> a.id
  AND a.canonical_image_id IS DISTINCT FROM c.id;

UPDATE public.product_images c
SET is_shared = true
WHERE EXISTS (SELECT 1 FROM public.product_images a WHERE a.canonical_image_id = c.id)
  AND c.is_shared IS DISTINCT FROM true;
