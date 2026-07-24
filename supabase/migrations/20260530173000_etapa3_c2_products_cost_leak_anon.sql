-- =============================================================================
-- Etapa 3 — Correção C2: vazamento de cost_price para o público (anon)
-- Projeto: pqpdolkaeqlyzpdpbizo (Promo Brindes / PromoGifts)
-- Aplicado em produção via Supabase MCP em 2026-05-30. Este arquivo existe para
-- rastreio/versionamento em git (o estado do banco já reflete estas mudanças).
-- =============================================================================
--
-- CAUSA-RAIZ
-- ----------
-- A tabela base public.products tinha RLS habilitada, porém a policy de leitura
--   products_public_read = SELECT USING (true)  para os papéis {anon, authenticated}
-- e o papel anon possuía grant de SELECT de coluna em campos sensíveis
-- (cost_price, suggested_price, supplier_reference, ipi_rate, ...). Resultado:
-- qualquer pessoa com a ANON KEY (que vai no bundle do front) conseguia ler o
-- custo de todos os produtos direto via PostgREST:
--     GET /rest/v1/products?select=cost_price,supplier_reference,ipi_rate
-- contornando a view mascarada v_products_public (que anula essas colunas).
-- Medição: 6.123 produtos, 6.118 com cost_price exposto ao anon.
--
-- POR QUE ESTA CORREÇÃO É SUFICIENTE (e não quebra o catálogo)
-- ----------------------------------------------------------------
-- 1) O catálogo público lê via v_products_public, que é security_invoker=false
--    (roda como dono, ignora a RLS do anon) e enumera as colunas anulando as
--    sensíveis. Removendo o anon da policy da BASE, o catálogo continua intacto.
-- 2) As views derivadas (v_products_complete, v_products_kit_builder,
--    vw_packagings_catalog, vw_products_packaging_info, vw_products_commercial_packing)
--    são security_invoker=on → leem a base como o papel chamador. Com o anon sem
--    linhas na base, elas deixam de vazar custo em CASCATA (validado: 0 não-nulos).
-- 3) O whitelist REST-native (src/lib/external-db/rest-native.ts) mapeia
--    products -> v_products_public; nenhum caminho anon lê a base direta (exceto
--    mockupGenerationService, que seleciona só `id` e degrada para vazio sem erro).
-- 4) suppliers já estava correto: sua policy de SELECT é só para authenticated,
--    então o anon nunca leu api_credentials/cnpj. Nenhuma mudança necessária.
--
-- RESIDUAIS CONHECIDOS (fora do escopo do C2 — tratar em passo próprio)
-- --------------------------------------------------------------------
-- - Usuários `authenticated` (logados) ainda leem cost_price via base (USING true).
--   Se houver clientes logados não-admin, exige separar a leitura de custo do
--   admin (RPC/edge com service_role).
-- - O form de admin lê o produto pela view mascarada (cost_price NULL com bridge
--   OFF) — possível bug de UX pré-existente, ticket à parte.
--
-- VALIDAÇÃO: >340 asserções executadas em produção dentro de transações
-- revertidas (RAISE EXCEPTION), 0 violações. Sentinelas pós-aplicação:
--   anon base: 0 linhas / 0 cost  | authenticated base: 6123 | view: 6123/cost NULL
--   v_products_complete (anon): 0 cost | anon INSERT/UPDATE: revogados
-- =============================================================================

BEGIN;

-- 1) Remove o anon da política de leitura: a base passa a ser legível apenas por
--    authenticated (admin). O público lê somente via v_products_public.
-- Guard: policy pode não existir em preview snapshots.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'products' AND policyname = 'products_public_read'
  ) THEN
    ALTER POLICY products_public_read ON public.products TO authenticated;
  END IF;
END $$;

-- 2) Higiene de privilégios: o anon nunca escreve em products (a RLS de escrita já
--    exige is_org_owner_or_admin). Remove os grants amplos para reduzir superfície
--    (inclui TRUNCATE, que não é filtrado por RLS).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.products FROM anon;

-- Observação: o grant de SELECT do anon na base é mantido de propósito, para que
-- leituras residuais (ex.: mockup .select('id')) degradem para conjunto vazio via
-- RLS em vez de "permission denied". A RLS (sem policy p/ anon) já garante 0 linhas.

COMMIT;
