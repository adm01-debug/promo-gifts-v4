-- BUG CRÍTICO: fn_site_promote_to_gold INSERT em xbz_gallery_staging
-- usava ON CONFLICT (sku, source_url) DO NOTHING mas não cobria
-- uq_xbz_staging_cf_id. Resultado: 55 falhas em 9.3h no xbz-site-scrape.
-- Fix: ON CONFLICT DO NOTHING (sem target = cobre QUALQUER constraint).
-- Apenas a linha do INSERT foi alterada — toda a lógica de negócio mantida.
-- O corpo completo da função está no apply_migration correspondente.
-- A função já foi corrigida em produção via apply_migration 2026-06-18.
-- Esta migration documenta o fix no histórico do repo.
SELECT 'fn_site_promote_to_gold: ON CONFLICT DO NOTHING fix applied 2026-06-18'::text AS status;
