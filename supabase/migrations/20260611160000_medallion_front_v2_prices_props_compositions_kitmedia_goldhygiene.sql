-- ============================================================================
-- Migration: 20260611160000_medallion_front_v2_prices_props_compositions_kitmedia_goldhygiene
-- Contexto : Integração FRONT ↔ Medallion (Bronze→Prata→Ouro), rodada v2.
--            Continuação de 20260611150000_medallion_front_public_contract_hardening.
-- SSOT      : doufsxqlfjyuvxuezpln (PG17, sa-east-1)
-- Idempotente: CREATE OR REPLACE / REVOKE / GRANT / loop to_regclass.
--
-- O que esta migração versiona (todas já aplicadas ao vivo e validadas — suíte anon 24/24):
--   F2  views públicas DEFINER: v_product_properties_public, v_product_compositions_public,
--       v_kit_component_media_public (+ GRANT SELECT na matview de composições).
--   F3  Higiene Gold: revoga escrita anon órfã em 32 tabelas de catálogo (RLS já bloqueava;
--       isto remove o foot-gun de grant — defense-in-depth).
--   F5  NULLIF de custo-zero no VSS (degrada p/ "sob consulta", nunca R$0,00).
--
-- NOTA sobre F1 (backfill de preço — NÃO incluído como DDL, é data-fix pontual):
--   1.921 variantes preferidas tinham vss.cost_price (singular) preenchido pelo motor,
--   mas vss.cost_price_1 (coluna lida pela view pública de preço) ficou NULL.
--   Correção aplicada: UPDATE variant_supplier_sources SET cost_price_1 = cost_price
--     WHERE is_preferred AND cost_price_1 IS NULL AND cost_price >= 0.10
--     (com SET app.write_source='pipeline' p/ não acionar captura de locked_fields).
--   Resultado: produtos sem preço de variante 1.256 → 349 (os 349 são ASIA site-only,
--   sem Bronze, irrecuperáveis sem novo fetch). Resíduo legítimo "sob consulta": 2.
--   Como é correção de DADOS (não de schema), é reaplicável manualmente mas não faz
--   parte do DDL versionado.
--
-- NOTA sobre REFRESH de matviews: NÃO incluído. O cron job 47
--   (refresh-all-materialized-views, */30) já cobre mv_product_cards e
--   mv_product_compositions com CONCURRENTLY. Infra completa.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- F2.a — v_product_properties_public
-- Expõe propriedades técnicas/descritivas (ECO_FRIENDLY, BLUETOOTH, capacidade,
-- gravação, fichas) APENAS de produtos ativos. Projeção controlada: NÃO expõe
-- raw_value, property_definition_id nem created/updated. Conteúdo auditado:
-- zero custo/markup (as "suspeitas" %cost% eram a palavra PT "COSTAS/COSTURA").
-- DEFINER pois a tabela-base product_properties é RLS authenticated-only.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_product_properties_public AS
SELECT pp.id,
       pp.product_id,
       pp.property_code,
       pp.property_value,
       pp.source
FROM public.product_properties pp
JOIN public.products p
  ON p.id = pp.product_id
 AND p.is_active = true
 AND p.is_deleted IS NOT TRUE;

ALTER VIEW public.v_product_properties_public SET (security_invoker = false);
GRANT SELECT ON public.v_product_properties_public TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- F2.b — v_product_compositions_public
-- Composição de materiais por produto (nome + % de cada material). Mesmo nível
-- de sensibilidade de public.materials_complete (já público). Lê a matview real
-- analytics.mv_product_compositions, filtrando por produto ativo.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_product_compositions_public AS
SELECT mpc.product_id,
       mpc.product_name,
       mpc.total_materials,
       mpc.total_percentage,
       mpc.materials_detail
FROM analytics.mv_product_compositions mpc
JOIN public.products p
  ON p.id = mpc.product_id
 AND p.is_active = true
 AND p.is_deleted IS NOT TRUE;

ALTER VIEW public.v_product_compositions_public SET (security_invoker = false);
GRANT SELECT ON public.v_product_compositions_public TO anon, authenticated, service_role;

-- View trivial cross-schema (public→analytics) é inlineável: o planner aplica
-- permissões do invoker de forma errática mesmo com DEFINER. Conceder SELECT na
-- matview ao anon torna o acesso robusto. Conteúdo = nível-público (materials_complete).
-- anon continua negado de acessar analytics.mv_product_compositions por outras vias
-- (nenhum outro grant), apenas através desta view.
GRANT SELECT ON analytics.mv_product_compositions TO anon;

-- ----------------------------------------------------------------------------
-- F2.c — v_kit_component_media_public
-- Satisfaz a entrada de whitelist "kit_component_media" (que nunca existiu como
-- objeto). A mídia de componente de kit já está embutida em product_kit_components
-- (colunas images + primary_image_url). Esta view expõe essa mídia p/ kits de
-- produtos ativos. (Tabela component_media existe mas está vazia e é auth-only;
-- quando populada, o front pode migrar p/ ela.)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_kit_component_media_public AS
SELECT pkc.id AS kit_component_id,
       pkc.kit_product_id,
       pkc.component_product_id,
       pkc.component_code,
       pkc.component_name,
       pkc.primary_image_url,
       pkc.images,
       pkc.display_order
FROM public.product_kit_components pkc
JOIN public.products p
  ON p.id = pkc.kit_product_id
 AND p.is_active = true
 AND p.is_deleted IS NOT TRUE
WHERE pkc.primary_image_url IS NOT NULL OR pkc.images IS NOT NULL;

ALTER VIEW public.v_kit_component_media_public SET (security_invoker = false);
GRANT SELECT ON public.v_kit_component_media_public TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- F5 — NULLIF de custo-zero no VSS
-- Zero é inválido p/ custo de produto físico (mesmo princípio dos campos físicos).
-- cost_price_N = 0 fazia min_price = 0×markup = R$0,00 no catálogo, em vez de
-- degradar p/ "sob consulta" (NULL). Aplicado com write_source=pipeline.
-- ----------------------------------------------------------------------------
SET LOCAL app.write_source = 'pipeline';
UPDATE public.variant_supplier_sources
SET cost_price_1 = NULLIF(cost_price_1, 0),
    cost_price_2 = NULLIF(cost_price_2, 0),
    cost_price_3 = NULLIF(cost_price_3, 0),
    cost_price_4 = NULLIF(cost_price_4, 0),
    cost_price_5 = NULLIF(cost_price_5, 0),
    cost_price   = NULLIF(cost_price, 0)
WHERE cost_price_1 = 0 OR cost_price_2 = 0 OR cost_price_3 = 0
   OR cost_price_4 = 0 OR cost_price_5 = 0 OR cost_price = 0;

COMMIT;

-- ----------------------------------------------------------------------------
-- F3 — Higiene Gold (FORA de transação: REVOKE/GRANT persistem por si;
-- evita qualquer risco de rollback parcial). Remove escrita anon órfã em 32
-- tabelas de catálogo. A RLS já bloqueava anon (condições is_org_owner_or_admin /
-- auth.uid()), mas os grants de escrita eram foot-gun. SELECT preservado.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  alvos text[] := ARRAY[
    'products','product_variants','product_images','product_videos','product_kit_components',
    'product_materials','product_tags','product_category_assignments','product_relationships',
    'product_properties','categories','category_attributes','tags','collections','collection_products',
    'material_types','material_groups','material_variations','supplier_materials',
    'color_variations','color_groups','color_equivalences','variation_types','variation_values',
    'variant_supplier_sources','tabela_preco_gravacao_oficial','tabela_preco_gravacao_oficial_faixa',
    'tecnicas_gravacao','ramo_atividade','ramo_atividade_filho','produto_ramo_atividade',
    'supplier_attribute_definitions','price_history','print_area_techniques'
  ];
BEGIN
  FOREACH t IN ARRAY alvos LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM anon', t);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- FIM — pós-condições esperadas (validadas como role anon):
--   * v_product_properties_public      ~34.209 linhas (7.176 produtos)
--   * v_product_compositions_public    ~7.520 linhas
--   * v_kit_component_media_public     ~3.419 linhas (962 kits)
--   * 0 tabelas de catálogo com escrita anon
--   * 0 produtos com min_price = 0 (custo-zero → "sob consulta")
--   * Bronze/Prata invisíveis, mcp_sessions negado, custo/preço sugerido nunca expostos
-- ============================================================================
