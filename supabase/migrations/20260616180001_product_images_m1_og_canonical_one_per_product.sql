-- ============================================================================
-- MELHORIA 1 — OG canonico: exatamente 1 og_image por produto ATIVO (= a primaria)
-- Aplicado em prod (doufsxqlfjyuvxuezpln) via MCP em 2026-06-16; este arquivo espelha o estado.
-- Idempotente e reversivel (apenas flags booleanas).
-- Corrige: 1.660 produtos sem OG, 1 produto com 2 OG, 161 OG em nao-primaria, 140 OG em inativa.
-- Triggers de sync mantem products.og_image_url (volume ~2,1k linhas).
-- https://claude.ai/code/session_01JWqwBkgRNk8v6ejLd18Hv9
-- ============================================================================

-- 1) Remove o flag OG de qualquer linha que NAO seja a primaria ativa
UPDATE public.product_images
   SET is_og_image = false
 WHERE is_og_image IS TRUE
   AND (is_primary IS NOT TRUE OR is_active IS NOT TRUE);

-- 2) Garante o flag OG na primaria ativa de todo produto que estava sem
UPDATE public.product_images
   SET is_og_image = true
 WHERE is_active IS TRUE
   AND is_primary IS TRUE
   AND is_og_image IS NOT TRUE;
