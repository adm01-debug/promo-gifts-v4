-- APLICADO: 2026-06-23 17:19 UTC
-- Migration: fix_discount_approval_requests_security_and_indexes
-- Autor: Claude — PhD Database Security Mode
--
-- BUGS CORRIGIDOS:
--   BUG-DAR-SECURITY: anon tinha SELECT grant em discount_approval_requests
--                     (tabela de aprovação de desconto — nunca deve ser anon)
--   BUG-DAR-PERF:     Badge polled a cada 30s sem índice em status='pending'
--                     causando seq_scan em tabela que cresce com o tempo
--
-- SEMÂNTICA:
--   Com RLS ativo e sem policy SELECT para anon, o grant era no-op (0 rows),
--   MAS comunicava a desenvolvedores que anon deveria ter acesso — confusão.
--   Além disso, PostgREST expõe o schema para roles com grant, o que
--   facilita enumeração de estrutura por atacantes.

-- 1. Revogar grant SELECT de anon (BUG-DAR-SECURITY)
REVOKE SELECT ON public.discount_approval_requests FROM anon;

-- 2. Índice parcial para query do badge (HEAD ?select=*&status=eq.pending)
--    Partial index = muito seletivo mesmo em low-cardinality (status)
CREATE INDEX IF NOT EXISTS idx_dar_status_pending
  ON public.discount_approval_requests (status)
  WHERE status = 'pending';

-- 3. Índice composto para dedup guard em requestApproval
CREATE INDEX IF NOT EXISTS idx_dar_quote_id_status
  ON public.discount_approval_requests (quote_id, status)
  WHERE status = 'pending';

-- 4. Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
