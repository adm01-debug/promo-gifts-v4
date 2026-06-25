-- Garante UMA única solicitação pendente por orçamento, mesmo sob
-- cliques repetidos / requisições concorrentes. O guard no client
-- (useDiscountApproval.requestApproval) continua útil para UX, mas
-- o banco passa a ser a fonte da verdade.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_dar_quote_pending
  ON public.discount_approval_requests (quote_id)
  WHERE status = 'pending';

COMMENT ON INDEX public.uniq_dar_quote_pending IS
  'Idempotência: no máximo 1 pending por quote_id. Caso (quote, pending) sob INSERT concorrente, o segundo recebe SQLSTATE 23505 e o client trata como sucesso.';