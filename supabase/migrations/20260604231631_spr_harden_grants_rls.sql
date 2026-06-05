-- P4: endurece privilégios na tabela de ingestão.
-- 1) anon/authenticated tinham GRANT de INSERT/UPDATE/REFERENCES em TODAS as colunas
--    (bomba latente: hoje só o RLS bloqueia escrita por falta de policy). Ingestão é
--    feita por service_role/funções SECURITY DEFINER; ninguém legítimo escreve como
--    anon/authenticated. Revogamos a escrita.
REVOKE INSERT, UPDATE, REFERENCES ON public.supplier_products_raw FROM anon;
REVOKE INSERT, UPDATE, REFERENCES ON public.supplier_products_raw FROM authenticated;

-- 2) Reduz exposição de colunas internas ao papel anon (acesso público do catálogo
--    Somarcas via views security_invoker). Estas colunas não são usadas por nenhuma
--    das views públicas (asia/somarcas/xbz), então revogar é não-disruptivo.
REVOKE SELECT (last_error, claimed_at, attempts, source_event_id, source_endpoint)
  ON public.supplier_products_raw FROM anon;
