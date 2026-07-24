-- ============================================================================
-- supplier_products_raw — HOTFIX: idx_spr_unprocessed predicado
-- ----------------------------------------------------------------------------
-- O predicado do índice era `status <> 'processed'` (inclui 'quarantined'),
-- mas o motor agora usa `status NOT IN ('processed','quarantined')`.
-- O PostgreSQL pode usar o índice mesmo assim (predicado da query implica o
-- do índice), mas visita linhas quarentenadas desnecessariamente antes de
-- descartá-las. Alinhar os predicados elimina esse overhead latente.
-- ============================================================================

DROP INDEX IF EXISTS public.idx_spr_unprocessed;

CREATE INDEX idx_spr_unprocessed
  ON public.supplier_products_raw (supplier_id, imported_at)
  WHERE status NOT IN ('processed'::supplier_raw_status, 'quarantined'::supplier_raw_status);
