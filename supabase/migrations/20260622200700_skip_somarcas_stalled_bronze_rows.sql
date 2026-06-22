-- ============================================================
-- MIGRATION: skip_somarcas_stalled_bronze_rows
-- Data: 2026-06-22
-- Ambiente: production (doufsxqlfjyuvxuezpln)
-- ============================================================
--
-- BUG: IMPORT_STALLED warning (-2 pts health score)
--   397 rows de Só Marcas em supplier_products_raw com status='pending'
--   importadas >1h atrás, nunca processadas pelo catálogo:
--     - 374 rows de 2026-02-26 (stock_status='processed') — 2804h stale
--     - 23 rows de 2026-06-07 (stock_status='skipped') — 366h stale
--   Todos os 397 produtos JÁ existem no catálogo (produtos importados
--   em batches subsequentes).
--
-- FIX: Marcar como 'skipped' — com guard EXISTS para garantir que
--   nenhuma row é skipped se o produto ainda não existe no catálogo.
-- ============================================================

UPDATE supplier_products_raw spr
SET status = 'skipped'
WHERE supplier_id = '841cd690-210a-422a-908c-7676828db272'
  AND status NOT IN ('processed', 'skipped')
  AND imported_at < now() - INTERVAL '1 hour'
  AND EXISTS (
    SELECT 1 FROM products p
    WHERE p.supplier_id = spr.supplier_id
      AND p.supplier_reference = spr.supplier_reference
  );
-- Resultado: 397 rows marcadas (374 fev + 23 jun)
-- Health score: 0 warnings, 100/100 A++ PERFEITO
