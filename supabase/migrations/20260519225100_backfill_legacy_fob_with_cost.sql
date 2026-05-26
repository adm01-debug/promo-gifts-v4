-- ============================================================================
-- BACKFILL: orçamentos legados com shipping_type='fob' AND shipping_cost>0
-- ============================================================================
--
-- CONTEXTO:
-- Ate 18/mai (commit 72c8639), o frontend salvava orcamentos com
-- shipping_type='fob' E shipping_cost>0 — entendia 'fob' como "FOB com custo
-- repassado ao cliente".
--
-- A partir de 18/mai, a semantica mudou:
--   'fob'     = cliente paga frete diretamente (cost = 0 no orcamento)
--   'fob_pre' = FOB Pré-negociado (cost no orcamento, repassado ao cliente)
--
-- Orçamentos legados que tinham shipping_type='fob' AND shipping_cost>0
-- representam, na nova semantica, exatamente 'fob_pre'. Esta migration os
-- converte para manter o cost no calculo do total (preservando o valor
-- combinado com o cliente).
--
-- SEGURANÇA:
-- - Não toca orçamentos com status 'approved' ou 'converted' (imutaveis).
-- - Não recalcula totals (sera feito pelo trigger fn_quotes_recalc na proxima
--   alteração de quote_items, ou pode ser feito manualmente via touch).
-- - Idempotente: na 2a execução, retorna 0 rows (todos já convertidos).
--
-- VALIDACAO PRE-AVISO:
-- Antes de aplicar, executar em transação para inspecionar:
--   BEGIN;
--   SELECT id, status, shipping_type, shipping_cost, total
--   FROM public.quotes
--   WHERE shipping_type = 'fob' AND shipping_cost > 0;
--   ROLLBACK;
-- ============================================================================

DO $$
DECLARE
  _converted_count integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quotes'
      AND column_name = 'shipping_type'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quotes'
      AND column_name = 'shipping_cost'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quotes'
      AND column_name = 'status'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quotes'
      AND column_name = 'updated_at'
  ) THEN
    RAISE NOTICE '[backfill_legacy_fob] Skipped: public.quotes legacy shipping columns are not present in this replay state';
    RETURN;
  END IF;

  UPDATE public.quotes
  SET shipping_type = 'fob_pre',
      updated_at = now()
  WHERE shipping_type = 'fob'
    AND shipping_cost > 0
    AND status NOT IN ('approved', 'converted');

  GET DIAGNOSTICS _converted_count = ROW_COUNT;
  RAISE NOTICE '[backfill_legacy_fob] Converted % quotes from fob+cost to fob_pre', _converted_count;
END $$;
