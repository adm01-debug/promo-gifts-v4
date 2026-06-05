-- Correções detectadas na auditoria exaustiva pós-refactor:
--
-- 1) fn_purge_spr_history: criada com SECURITY DEFINER mas sem REVOKE do grant
--    padrão PUBLIC/anon → qualquer usuário anônimo podia chamar via REST API
--    (GET /rest/v1/rpc/fn_purge_spr_history?p_keep_days=1) e apagar todo o
--    histórico. Restrita a service_role + postgres.
--
-- 2) supplier_products_raw_history: FK supplier_id sem índice (advisor
--    unindexed_foreign_keys) e captured_at sem índice (penaliza fn_purge_spr_history
--    que filtra WHERE captured_at < ...).

-- 1) Revoga execução pública de fn_purge_spr_history
REVOKE EXECUTE ON FUNCTION public.fn_purge_spr_history(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_purge_spr_history(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_purge_spr_history(integer) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_purge_spr_history(integer) TO service_role;

-- 2) Índice no FK supplier_id (JOIN frequente com suppliers)
CREATE INDEX IF NOT EXISTS idx_spr_hist_supplier
  ON public.supplier_products_raw_history (supplier_id);

-- 3) Índice em captured_at para que fn_purge_spr_history e queries de auditoria
--    não façam seq scan em tabela de crescimento ilimitado
CREATE INDEX IF NOT EXISTS idx_spr_hist_captured_at
  ON public.supplier_products_raw_history (captured_at);
