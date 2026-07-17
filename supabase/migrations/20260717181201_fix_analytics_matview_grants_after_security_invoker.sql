-- APLICADO: SIM — 2026-07-17 18:12 UTC (via MCP, version 20260717181201)
-- Migration: fix_analytics_matview_grants_after_security_invoker
-- Resultado: 5 views wrapper public.* voltaram a responder 200 para authenticated
-- Assertivas: varredura de SELECT real em todas as views/matviews de public → 0 erros 42501
-- Reversível: REVOKE SELECT ON analytics.<matview> FROM authenticated, service_role;
--
-- SINTOMA:
-- PostgREST devolvia 403 em /rest/v1/mv_stock_velocity e /rest/v1/mv_product_intelligence.
-- Console do catálogo com centenas de "403 (Forbidden)" — FiltersPage/ProductGrid.
--
-- CAUSA RAIZ:
-- As views de `public` foram convertidas para `security_invoker=true`. Com invoker,
-- o SELECT na matview subjacente passa a ser checado como o role CHAMADOR
-- (authenticated/anon), não mais como o owner (postgres). As matviews em `analytics`
-- nunca receberam GRANT correspondente:
--
--   public.mv_stock_velocity (view, invoker)   authenticated TEM select  ✓
--     └─> analytics.mv_stock_velocity (matview) ACL = NULL               ✗ 42501 → 403
--
-- Matview NÃO suporta RLS: o único gate possível é o GRANT. A conversão para invoker
-- quebrou a cadeia porque a view deixou de emprestar os privilégios do owner.
--
-- PRINCÍPIO DA CORREÇÃO:
-- A view wrapper em `public` já declara a intenção de acesso. Espelhamos essa intenção
-- exata na matview subjacente — nenhuma política nova é inventada aqui.
--
-- ESCOPO (encontrado por sweep, não pelo log):
-- O console mostrava 2 objetos; o sweep do grafo de dependências revelou 5.
--   categories_tree_visual · mv_product_cards · mv_product_compositions
--   mv_product_intelligence · mv_stock_velocity

-- Pré-requisito: USAGE no schema (já existia; idempotente)
GRANT USAGE ON SCHEMA analytics TO authenticated, anon, service_role;

-- authenticated: tem SELECT nas 5 views wrapper → precisa nas 5 matviews
GRANT SELECT ON analytics.categories_tree_visual  TO authenticated;
GRANT SELECT ON analytics.mv_product_cards        TO authenticated;
GRANT SELECT ON analytics.mv_product_compositions TO authenticated;
GRANT SELECT ON analytics.mv_product_intelligence TO authenticated;
GRANT SELECT ON analytics.mv_stock_velocity       TO authenticated;

-- service_role: havia perdido SELECT em 2 matviews (quebra edge functions / n8n / crons)
GRANT SELECT ON analytics.mv_product_intelligence TO service_role;
GRANT SELECT ON analytics.mv_stock_velocity       TO service_role;
GRANT SELECT ON analytics.categories_tree_visual  TO service_role;
GRANT SELECT ON analytics.mv_product_cards        TO service_role;
GRANT SELECT ON analytics.mv_product_compositions TO service_role;

-- anon: NÃO recebe SELECT em stock_velocity / product_intelligence / product_cards.
-- Contêm supplier_id, supplier_branch_id, current_price, price_changes_30d, sale_price
-- = inteligência competitiva. A view wrapper já negava anon (anon=m, sem r); mantemos
-- a negação coerente no objeto de baixo.
-- anon preserva apenas mv_product_compositions (nenhuma coluna sensível).
REVOKE ALL ON analytics.mv_stock_velocity       FROM anon;
REVOKE ALL ON analytics.mv_product_intelligence FROM anon;
REVOKE ALL ON analytics.mv_product_cards        FROM anon;
REVOKE ALL ON analytics.categories_tree_visual  FROM anon;
GRANT SELECT ON analytics.mv_product_compositions TO anon;

-- HIGIENE (achado P1 adjacente): matview não é atualizável, logo INSERT/UPDATE/DELETE
-- concedidos a anon/authenticated são lixo perigoso — apareciam como
-- `anon=awdxtm` (write sem read!) em public.mv_supplier_reliability.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON analytics.mv_stock_velocity, analytics.mv_product_intelligence,
     analytics.mv_product_cards, analytics.mv_product_compositions,
     analytics.categories_tree_visual
  FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON public.mv_supplier_reliability, public.mv_ema_kpi_by_level,
     public.mv_stock_rupture_alert, public.mv_product_images_audit
  FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON public.mv_stock_velocity, public.mv_product_intelligence,
     public.mv_product_cards, public.mv_product_compositions,
     public.categories_tree_visual
  FROM anon, authenticated;

-- BLINDAGEM CONTRA RECORRÊNCIA: nova matview em analytics já nasce legível por
-- authenticated/service_role e muda para anon. Sem isto, a próxima matview criada
-- reproduz exatamente este incidente.
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics
  GRANT SELECT ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics
  REVOKE ALL ON TABLES FROM anon;

-- Recarrega o schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
