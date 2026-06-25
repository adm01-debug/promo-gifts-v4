-- =====================================================================
-- Migration: alinhar CHECK `valid_quote_status` aos 10 status do FE.
-- =====================================================================
-- Banco canônico: doufsxqlfjyuvxuezpln (Gold). NÃO aplicar no projeto
-- pqpdolkaeqlyzpdpbizo (Lovable Cloud interno). Aplicar manualmente
-- pelo PO no Supabase Gold.
--
-- Antes desta migration, o CHECK aceitava apenas 7 status:
--   draft, pending, sent, approved, rejected, expired, converted
--
-- O FE (src/types/quote.ts → QUOTE_STATUSES) define 10. Faltam:
--   pending_approval, viewed, cancelled
--
-- O sanitizador `sanitizeQuoteStatus` no quoteService faz fallback para
-- 'pending' quando o banco devolve algo fora do enum; esta migration
-- elimina o gap permitindo que esses 3 novos valores sejam persistidos.
--
-- Rollback: ver docs/migrations/20260625120000_align_quote_status_check.down.sql
-- =====================================================================

BEGIN;

ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS valid_quote_status;

-- Pré-saneamento defensivo: a migration aborta (em vez de coagir
-- silenciosamente) se houver linhas com status fora do enum esperado.
DO $$
DECLARE
  bad_count int;
BEGIN
  SELECT count(*) INTO bad_count
  FROM public.quotes
  WHERE status IS NOT NULL
    AND status NOT IN (
      'draft', 'pending', 'pending_approval', 'sent', 'viewed',
      'approved', 'rejected', 'expired', 'cancelled', 'converted'
    );

  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'align_quote_status_check abortada: % linha(s) em public.quotes possuem status fora do enum esperado. '
      'Audite com: SELECT id, status FROM public.quotes WHERE status NOT IN (...);',
      bad_count;
  END IF;
END $$;

ALTER TABLE public.quotes
  ADD CONSTRAINT valid_quote_status
  CHECK (status IN (
    'draft', 'pending', 'pending_approval', 'sent', 'viewed',
    'approved', 'rejected', 'expired', 'cancelled', 'converted'
  ));

COMMENT ON CONSTRAINT valid_quote_status ON public.quotes IS
  'SSOT compartilhado com src/types/quote.ts (QUOTE_STATUSES). Atualizar SEMPRE em conjunto.';

COMMIT;
