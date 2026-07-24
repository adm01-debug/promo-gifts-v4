
-- ============================================================================
-- supplier_products_raw — HOTFIX: idx_spr_unprocessed predicate
-- ----------------------------------------------------------------------------
-- O predicado do índice era `status <> 'processed'` (inclui quarantined), mas
-- o motor usa `status NOT IN ('processed','quarantined')`. O PostgreSQL pode
-- usar o índice mesmo assim (predicado da query implica o do índice), porém
-- visita linhas quarentenadas desnecessariamente. Alinhando o predicado.
-- ============================================================================

DROP INDEX IF EXISTS public.idx_spr_unprocessed;

CREATE INDEX idx_spr_unprocessed
  ON public.supplier_products_raw (supplier_id, imported_at)
  WHERE status NOT IN ('processed'::supplier_raw_status, 'quarantined'::supplier_raw_status);
