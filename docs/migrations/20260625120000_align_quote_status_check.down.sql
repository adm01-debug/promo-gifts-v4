-- =====================================================================
-- ROLLBACK: 20260625120000_align_quote_status_check
-- =====================================================================
-- Reverte o CHECK `valid_quote_status` para o enum legado de 7 status.
--
-- ATENÇÃO — operação LOSSY:
--   Linhas com status 'pending_approval' ou 'viewed' são coagidas a
--   'pending'; linhas em 'cancelled' são coagidas a 'rejected'. Sem
--   isso o ADD CONSTRAINT falha com SQLSTATE 23514.
--
-- Recomendação: dumpar antes:
--   COPY (SELECT id, status FROM public.quotes
--         WHERE status IN ('pending_approval','viewed','cancelled'))
--     TO '/tmp/quotes_status_rollback_backup.csv' WITH CSV HEADER;
-- =====================================================================

BEGIN;

UPDATE public.quotes SET status = 'pending'
 WHERE status IN ('pending_approval', 'viewed');

UPDATE public.quotes SET status = 'rejected'
 WHERE status = 'cancelled';

ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS valid_quote_status;

ALTER TABLE public.quotes
  ADD CONSTRAINT valid_quote_status
  CHECK (status IN (
    'draft', 'pending', 'sent', 'approved', 'rejected', 'expired', 'converted'
  ));

COMMIT;
