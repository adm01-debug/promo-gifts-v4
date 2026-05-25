-- =============================================================
-- FASE 3 — Índices parciais para queries lentas detectadas via pg_stat_statements
--
-- ANTES (mean_exec_time):
--   is_bestseller=true AND is_bestseller_expires_at < now() → 711ms × 778 calls = 553s total
--   is_featured=true AND is_featured_expires_at < now()     → 678ms × 778 calls = 527s total
--
-- DEPOIS (estimado, com índice parcial cobrindo só rows ativas):
--   < 50ms por query (>90% redução)
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_products_bestseller_expires
  ON public.products (is_bestseller_expires_at)
  WHERE is_bestseller = true AND is_bestseller_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_featured_expires
  ON public.products (is_featured_expires_at)
  WHERE is_featured = true AND is_featured_expires_at IS NOT NULL;

COMMENT ON INDEX public.idx_products_bestseller_expires IS
'Índice parcial para query de banner bestsellers (rotina diária via cron). Criado em 2026-05-24 fase 3.';

COMMENT ON INDEX public.idx_products_featured_expires IS
'Índice parcial para query de banner featured (rotina diária via cron). Criado em 2026-05-24 fase 3.';
