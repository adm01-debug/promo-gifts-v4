-- ============================================================================
-- MELHORIA 3/3 — slug unico em color_variations (camada OURO, higiene URL/SEO)
-- Alinha ao padrao de color_groups (unique global em slug). Substitui o indice
-- nao-unico redundante idx_color_variations_slug pelo unico.
-- ANTI-REGRESSAO (Lovable bot): manter color_variations_slug_unique.
-- fix_version: 2026-06-26_color_slug_unique
-- ============================================================================

DROP INDEX IF EXISTS idx_color_variations_slug;

CREATE UNIQUE INDEX IF NOT EXISTS color_variations_slug_unique
  ON color_variations (slug);

COMMENT ON INDEX color_variations_slug_unique IS
  'Slug unico global (URL/SEO), alinhado a color_groups_slug_unique. fix_version 2026-06-26. NAO REMOVER.';
