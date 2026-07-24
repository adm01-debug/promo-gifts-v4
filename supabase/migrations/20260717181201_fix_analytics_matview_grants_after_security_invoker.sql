-- APLICADO: SIM — 2026-07-17 18:12 UTC (via MCP, version 20260717181201)
-- Migration: fix_analytics_matview_grants_after_security_invoker
-- Resultado: 5 views wrapper public.* voltaram a responder 200 para authenticated
-- Assertivas: SELECT real em toda view/matview de public como authenticated e anon
--             → 0 erros 42501. anon segue bloqueado nas MVs sensíveis.
-- Reversível: REVOKE SELECT ON analytics.<matview> FROM authenticated, service_role;
-- Guards: cada objeto pode não existir em preview snapshots (criados out-of-band),
--         mesmo padrão de 20260531220000_grant_select_analytics_views_authenticated.sql
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- SINTOMA
-- ═══════════════════════════════════════════════════════════════════════════════
-- PostgREST devolvia 403 em /rest/v1/mv_stock_velocity e /rest/v1/mv_product_intelligence.
-- Console do catálogo com centenas de "403 (Forbidden)" em FiltersPage/ProductGrid.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- CAUSA RAIZ — migration 063 se auto-sabotou
-- ═══════════════════════════════════════════════════════════════════════════════
-- A 20260717000063 fez, no mesmo arquivo, duas coisas incompatíveis entre si:
--
--   Phase 4: ALTER VIEW public.mv_stock_velocity SET (security_invoker = true)
--            + sweep aplicando invoker em toda view de public sem ele
--   Phase 5: revoke direct access em analytics.* FROM PUBLIC, anon E authenticated
--
-- Uma fez a view depender do privilégio do CHAMADOR; a outra tirou esse privilégio:
--
--   public.mv_stock_velocity (view, invoker)   authenticated TEM select  ✓
--     └─> analytics.mv_stock_velocity (matview) ACL = NULL               ✗ 42501 → 403
--
-- Matview NÃO suporta RLS: o único gate possível é o GRANT. Sem ele a cadeia quebra.
-- A 063 previu o efeito (linha 27: "wraps analytics.mv_stock_velocity which
-- authenticated cannot access directly") e seguiu assim mesmo, com "fallback" de
-- revogar a view — na prática, aceitar que a feature morre. O objetivo era zerar o
-- advisor (security_definer_view 3→0); o custo foi 5 telas.
--
-- Precedente: 20260531220000 corrigiu ESTE MESMO bug em 31/05. É recorrente.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- CORREÇÃO
-- ═══════════════════════════════════════════════════════════════════════════════
-- A intenção da 063 era fechar o `anon` (findings: pg_graphql_anon_table_exposed).
-- O erro foi a marreta da Phase 5 pegar `authenticated` junto. Restauramos apenas
-- `authenticated`/`service_role`, preservando o fechamento do `anon`.
--
-- Princípio: a view wrapper de public já declara a intenção de acesso; espelhamos
-- essa intenção exata na matview subjacente. Nenhuma política nova inventada.
--
-- ESCOPO (encontrado por sweep do grafo de dependências, não pelo console):
-- O log mostrava 2 objetos; o sweep revelou 5.

DO $$
DECLARE
  o        text;
  schema_n text;
  obj_n    text;
  -- Matviews em analytics que alimentam wrappers security_invoker em public.
  -- authenticated + service_role precisam de SELECT direto para a cadeia funcionar.
  objs_read text[] := ARRAY[
    'analytics.categories_tree_visual',
    'analytics.mv_product_cards',
    'analytics.mv_product_compositions',
    'analytics.mv_product_intelligence',
    'analytics.mv_stock_velocity'
  ];
  -- Objetos onde privilégio de escrita para anon/authenticated é lixo:
  -- matview não é atualizável. Havia `anon=awdxtm` (write sem read!) em
  -- public.mv_supplier_reliability.
  objs_clean text[] := ARRAY[
    'analytics.categories_tree_visual',
    'analytics.mv_product_cards',
    'analytics.mv_product_compositions',
    'analytics.mv_product_intelligence',
    'analytics.mv_stock_velocity',
    'public.categories_tree_visual',
    'public.mv_product_cards',
    'public.mv_product_compositions',
    'public.mv_product_intelligence',
    'public.mv_stock_velocity',
    'public.mv_supplier_reliability',
    'public.mv_ema_kpi_by_level',
    'public.mv_stock_rupture_alert',
    'public.mv_product_images_audit'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'analytics') THEN
    RAISE NOTICE '[181201] schema analytics ausente — nada a fazer';
    RETURN;
  END IF;

  -- Pré-requisito: USAGE no schema (já existia; idempotente)
  GRANT USAGE ON SCHEMA analytics TO authenticated, anon, service_role;

  -- 1) Restaura o SELECT que a Phase 5 da 063 removeu, só para os roles logados.
  FOREACH o IN ARRAY objs_read LOOP
    schema_n := split_part(o, '.', 1);
    obj_n    := split_part(o, '.', 2);
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = schema_n AND c.relname = obj_n AND c.relkind IN ('r','v','m','f','p')
    ) THEN
      EXECUTE format('GRANT SELECT ON %s TO authenticated, service_role', o);
      RAISE NOTICE '[181201] GRANT SELECT em % → authenticated, service_role', o;
    ELSE
      RAISE NOTICE '[181201] % ausente (preview snapshot) — pulado', o;
    END IF;
  END LOOP;

  -- 2) anon permanece FORA das MVs com supplier_id / preço / velocidade.
  --    Preserva o objetivo da 063 e a negação que a view wrapper já declarava.
  --    mv_product_compositions é a única sem coluna sensível → anon mantém leitura.
  FOREACH o IN ARRAY ARRAY[
    'analytics.categories_tree_visual',
    'analytics.mv_product_cards',
    'analytics.mv_product_intelligence',
    'analytics.mv_stock_velocity'
  ] LOOP
    schema_n := split_part(o, '.', 1);
    obj_n    := split_part(o, '.', 2);
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = schema_n AND c.relname = obj_n AND c.relkind IN ('r','v','m','f','p')
    ) THEN
      EXECUTE format('REVOKE ALL ON %s FROM anon', o);
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'analytics' AND c.relname = 'mv_product_compositions'
  ) THEN
    GRANT SELECT ON analytics.mv_product_compositions TO anon;
  END IF;

  -- 3) Higiene: matview não é atualizável — remove write concedido a anon/authenticated.
  FOREACH o IN ARRAY objs_clean LOOP
    schema_n := split_part(o, '.', 1);
    obj_n    := split_part(o, '.', 2);
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = schema_n AND c.relname = obj_n AND c.relkind IN ('v','m')
    ) THEN
      EXECUTE format(
        'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON %s FROM anon, authenticated',
        o
      );
    END IF;
  END LOOP;
END $$;

-- NOTA sobre blindagem contra recorrência:
-- A primeira versão desta migration usava
--   ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT SELECT ON TABLES TO authenticated
-- para impedir a repetição. Removido após review: concederia SELECT direto em
-- QUALQUER objeto futuro de analytics, não só nas matviews que alimentam wrappers —
-- contrariando a Phase 5 da 063, que fecha o schema deliberadamente.
-- Ver 20260717190000_narrow_analytics_default_privileges_to_explicit_grants.sql.
-- A proteção correta é um gate de CI que rode o sweep de 403, não um privilégio amplo.

NOTIFY pgrst, 'reload schema';
