-- =============================================================================
-- GRANTs de nivel de tabela para as tabelas endurecidas em 20260605100708.
-- =============================================================================
-- O Postgres checa privilegios de TABELA antes das policies RLS. As tabelas
-- abaixo foram criadas DEPOIS das migrations "GRANT ... ON ALL TABLES" amplas,
-- entao aqueles grants nao as alcancam, e nao ha default privileges/GRANT
-- posterior para elas no repo. Resultado num replay limpo: "permission denied"
-- apesar das policies (authenticated SELECT / service_role ALL).
--
-- Esta migration concede explicitamente os privilegios que as policies ja
-- assumem. Apenas ADITIVO e idempotente: na prod (onde os grants ja existem via
-- default privileges) e no-op; num replay do repo, fecha o gap. Nada e revogado,
-- entao o hardening de 20260605100708 (que removeu escrita de authenticated e
-- acesso de anon) permanece intacto. anon nao recebe nada aqui de proposito.

-- mcp_sessions: contrato pos-hardening = service_role apenas.
GRANT ALL ON TABLE public.mcp_sessions TO service_role;

-- produtos_padronizacao (silver): authenticated le; service_role escreve.
GRANT SELECT ON TABLE public.produtos_padronizacao TO authenticated;
GRANT ALL    ON TABLE public.produtos_padronizacao TO service_role;

-- product_physical: authenticated le; service_role escreve.
GRANT SELECT ON TABLE public.product_physical TO authenticated;
GRANT ALL    ON TABLE public.product_physical TO service_role;

-- supplier_price_tiers: authenticated le; service_role escreve.
GRANT SELECT ON TABLE public.supplier_price_tiers TO authenticated;
GRANT ALL    ON TABLE public.supplier_price_tiers TO service_role;
