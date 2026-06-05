-- Hardening de segurança (auditoria PR #659, achados CodeRabbit/Codex/cubic).
-- service_role tem BYPASSRLS no Supabase, então o pipeline (edge/cron/SECURITY
-- DEFINER) continua escrevendo normalmente após estas restrições.

-- (P0) mcp_sessions guarda cookies de sessão: hoje anon tem policy FOR ALL
-- USING(true) + GRANT total. Fecha para service_role apenas.
DROP POLICY IF EXISTS mcp_sessions_anon_all ON public.mcp_sessions;
REVOKE ALL ON TABLE public.mcp_sessions FROM anon, authenticated;
DROP POLICY IF EXISTS mcp_sessions_service_all ON public.mcp_sessions;
CREATE POLICY mcp_sessions_service_all ON public.mcp_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- produtos_padronizacao (camada silver): contrato = service_role escreve,
-- authenticated só lê. Hoje a policy é FOR ALL USING/CHECK(true).
DROP POLICY IF EXISTS pad_authenticated_all ON public.produtos_padronizacao;
DROP POLICY IF EXISTS pad_authenticated_read ON public.produtos_padronizacao;
CREATE POLICY pad_authenticated_read ON public.produtos_padronizacao
  FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.produtos_padronizacao FROM authenticated;

-- product_physical: remove escrita ampla de authenticated (mantém leitura e o
-- product_physical_service); revoga grants de anon.
DROP POLICY IF EXISTS product_physical_ins ON public.product_physical;
DROP POLICY IF EXISTS product_physical_upd ON public.product_physical;
DROP POLICY IF EXISTS product_physical_del ON public.product_physical;
REVOKE ALL ON TABLE public.product_physical FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.product_physical FROM authenticated;

-- supplier_price_tiers: contém cost_price (custo de fornecedor). Remove escrita
-- de authenticated e grants de anon; mantém leitura por authenticated e o
-- supplier_price_tiers_service.
DROP POLICY IF EXISTS supplier_price_tiers_ins ON public.supplier_price_tiers;
DROP POLICY IF EXISTS supplier_price_tiers_upd ON public.supplier_price_tiers;
DROP POLICY IF EXISTS supplier_price_tiers_del ON public.supplier_price_tiers;
REVOKE ALL ON TABLE public.supplier_price_tiers FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.supplier_price_tiers FROM authenticated;

-- fn_dryrun_raw_v2 é SECURITY DEFINER e hoje executável por anon/authenticated
-- (enumera supplier_settings/products/variants com privilégio elevado).
REVOKE EXECUTE ON FUNCTION public.fn_dryrun_raw_v2(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_dryrun_raw_v2(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_dryrun_raw_v2(uuid, integer) FROM authenticated;