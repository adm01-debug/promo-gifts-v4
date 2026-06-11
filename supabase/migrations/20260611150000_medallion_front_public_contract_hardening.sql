-- ============================================================================
-- 20260611150000_medallion_front_public_contract_hardening.sql
-- ----------------------------------------------------------------------------
-- Consolida (idempotente) as correcoes M1-M6 aplicadas AO VIVO em
-- doufsxqlfjyuvxuezpln em 2026-06-11 (MCP execute_sql), durante a integracao
-- front-end <-> arquitetura Medallion (Bronze / Prata / Ouro).
--
-- Esta versao foi registrada em supabase_migrations.schema_migrations como
-- MARCADOR (statements referenciam este arquivo homonimo, padrao ja usado no
-- repo), portanto `db push` nao tenta reaplicar. O arquivo e seguro para
-- replay: guards to_regclass + no-op quando ja aplicado.
--
--  M1  v_products_public               + filtro is_active = true (fecha vazamento de 19 inativos/fantasmas)
--  M2  v_variant_sale_prices_public    reescrita SECURITY DEFINER nas tabelas-base (anon: 42501 -> 18.359 rows)
--  M3  v_products_min_price            agrega PRECO DE VENDA (antes expunha CUSTO como min_price e quebrava p/ anon)
--  M4  v_print_area_techniques_public  DEFINER + is_active (anon: 0 -> 21.319 rows)
--  M5  P0  mcp_sessions                fecha leitura/escrita anon (vazava cookie de sessao do portal So Marcas)
--  M6  Bronze/Silver/staging           REVOKE escrita de anon (defense-in-depth; RLS ja bloqueava)
--
-- Validacao: suite T01-T18 como role anon = 18/18 OK + E2E PostgREST com a
-- publishable key de producao. Detalhes: docs/INTEGRACAO_MEDALLION_FRONT.md
-- ============================================================================

-- ----------------------------------------------------------------------------
-- M1 - v_products_public: injeta is_active = true preservando o restante da
-- view (158 colunas). Patch cirurgico sobre pg_get_viewdef; em producao o
-- filtro ja existe => no-op.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_def text;
BEGIN
  IF to_regclass('public.v_products_public') IS NULL THEN
    RAISE NOTICE 'M1: v_products_public nao existe - pulando';
    RETURN;
  END IF;

  SELECT pg_get_viewdef('public.v_products_public'::regclass, true) INTO v_def;

  -- a unica ocorrencia possivel de "is_active = true" nesta view (FROM products
  -- sem joins) e o proprio filtro do WHERE; a projecao apenas lista a coluna.
  IF v_def ~* 'is_active\s*=\s*true' THEN
    RAISE NOTICE 'M1: filtro is_active ja presente em v_products_public - no-op';
    RETURN;
  END IF;

  IF v_def !~* 'is_deleted\s+IS\s+NOT\s+TRUE' THEN
    RAISE EXCEPTION 'M1: marcador WHERE (is_deleted IS NOT TRUE) nao encontrado em v_products_public - revisar manualmente';
  END IF;

  v_def := regexp_replace(v_def, '(is_deleted\s+IS\s+NOT\s+TRUE)', '\1 AND is_active = true', 'i');
  EXECUTE 'CREATE OR REPLACE VIEW public.v_products_public AS ' || v_def;
  RAISE NOTICE 'M1: filtro is_active = true aplicado em v_products_public';
END $$;

-- ----------------------------------------------------------------------------
-- M2 - v_variant_sale_prices_public: reescrita SECURITY DEFINER direto nas
-- tabelas-base. Causa raiz do 42501 anterior: a versao antiga (invoker)
-- delegava para vw_variant_sale_prices, que le suppliers.default_markup_percent
-- sem grant para anon. Tornar a interna DEFINER vazaria custo (anon tem grant
-- nela); a solucao correta e esta view publica calcular o PRECO DE VENDA
-- diretamente, expondo apenas sku/cor/faixas/precos finais (custo nunca sai).
-- Cadeia de markup: variante -> produto -> categoria -> supplier default -> 115%.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_variant_sale_prices_public AS
SELECT pv.id AS variant_id,
    pv.product_id,
    pv.sku,
    pv.color_name,
    vss.min_qty_1,
    round(vss.cost_price_1 * (1::numeric + COALESCE(mc_var.markup_percent, mc_prod.markup_percent, mc_cat.markup_percent, s.default_markup_percent, 115.0) / 100::numeric), 2) AS sale_price_1,
    vss.min_qty_2,
    round(vss.cost_price_2 * (1::numeric + COALESCE(mc_var.markup_percent, mc_prod.markup_percent, mc_cat.markup_percent, s.default_markup_percent, 115.0) / 100::numeric), 2) AS sale_price_2,
    vss.min_qty_3,
    round(vss.cost_price_3 * (1::numeric + COALESCE(mc_var.markup_percent, mc_prod.markup_percent, mc_cat.markup_percent, s.default_markup_percent, 115.0) / 100::numeric), 2) AS sale_price_3,
    vss.min_qty_4,
    round(vss.cost_price_4 * (1::numeric + COALESCE(mc_var.markup_percent, mc_prod.markup_percent, mc_cat.markup_percent, s.default_markup_percent, 115.0) / 100::numeric), 2) AS sale_price_4,
    vss.min_qty_5,
    round(vss.cost_price_5 * (1::numeric + COALESCE(mc_var.markup_percent, mc_prod.markup_percent, mc_cat.markup_percent, s.default_markup_percent, 115.0) / 100::numeric), 2) AS sale_price_5
   FROM public.product_variants pv
     JOIN public.products p ON p.id = pv.product_id AND p.is_active = true AND p.is_deleted IS NOT TRUE
     JOIN public.variant_supplier_sources vss ON vss.variant_id = pv.id AND vss.is_preferred = true
     LEFT JOIN public.suppliers s ON s.id = vss.supplier_id
     LEFT JOIN public.markup_configurations mc_var ON mc_var.variant_id = pv.id AND mc_var.is_active = true
     LEFT JOIN public.markup_configurations mc_prod ON mc_prod.product_id = pv.product_id AND mc_prod.variant_id IS NULL AND mc_prod.category_id IS NULL AND mc_prod.is_active = true
     LEFT JOIN public.markup_configurations mc_cat ON mc_cat.category_id = (( SELECT products.category_id
           FROM public.products
          WHERE products.id = pv.product_id)) AND mc_cat.product_id IS NULL AND mc_cat.variant_id IS NULL AND mc_cat.is_active = true
  WHERE pv.is_active = true;

ALTER VIEW public.v_variant_sale_prices_public SET (security_invoker = false);
GRANT SELECT ON public.v_variant_sale_prices_public TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- M3 - v_products_min_price: recriada SOBRE o contrato publico (M2 + view de
-- catalogo). A versao anterior tinha DUPLO defeito: (a) expunha
-- min(vss.cost_price_1) -- CUSTO -- como min_price publico; (b) quebrava para
-- anon com "permission denied for function user_belongs_to_org". Agora agrega
-- PRECO DE VENDA e herda os filtros de catalogo ativo das views publicas.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_products_min_price AS
SELECT vp.product_id,
    p.name,
    p.sku,
    min(vp.sale_price_1) AS min_price,
    max(vp.sale_price_1) AS max_price,
    count(DISTINCT vp.variant_id) AS variants_count
   FROM public.v_variant_sale_prices_public vp
     JOIN public.v_products_public p ON p.id = vp.product_id
  GROUP BY vp.product_id, p.name, p.sku;

ALTER VIEW public.v_products_min_price SET (security_invoker = false);
GRANT SELECT ON public.v_products_min_price TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- M4 - v_print_area_techniques_public: a tabela-base print_area_techniques e
-- RLS auth-only (anon = 0 rows). A view publica passa a ser DEFINER com filtro
-- is_active = true, expondo apenas geometria/ordem das areas de gravacao
-- (nada sensivel). anon: 0 -> 21.319 rows.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_print_area_techniques_public AS
SELECT id,
    product_id,
    tabela_preco_id,
    location_code,
    location_name,
    max_width,
    max_height,
    is_curved,
    shape,
    technique_order,
    location_order,
    is_active,
    created_at,
    updated_at
   FROM public.print_area_techniques
  WHERE is_active = true;

ALTER VIEW public.v_print_area_techniques_public SET (security_invoker = false);
GRANT SELECT ON public.v_print_area_techniques_public TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- M5 - P0 SEGURANCA - mcp_sessions: as policies mcp_sessions_anon_read /
-- mcp_sessions_anon_write + grants permitiam que QUALQUER visitante lesse (e
-- escrevesse) o cookie de sessao do portal So Marcas via publishable key.
-- Provado por E2E PostgREST antes do fix; depois: 42501. Acesso passa a ser
-- exclusivo de service_role (policy mcp_sessions_service_all preexistente).
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.mcp_sessions') IS NULL THEN
    RAISE NOTICE 'M5: mcp_sessions nao existe - pulando';
    RETURN;
  END IF;
  EXECUTE 'DROP POLICY IF EXISTS mcp_sessions_anon_read ON public.mcp_sessions';
  EXECUTE 'DROP POLICY IF EXISTS mcp_sessions_anon_write ON public.mcp_sessions';
  EXECUTE 'REVOKE ALL ON public.mcp_sessions FROM anon';
  EXECUTE 'GRANT ALL ON public.mcp_sessions TO service_role';
  RAISE NOTICE 'M5: mcp_sessions fechado para anon (somente service_role)';
END $$;

-- ----------------------------------------------------------------------------
-- M6 - Defense-in-depth Bronze/Silver/staging: revoga ESCRITA de anon. RLS ja
-- bloqueava (nenhuma policy de escrita anon), mas grants de escrita orfaos sao
-- foot-gun. SELECT e mantido deliberadamente (RLS retorna 0 rows; grants de
-- leitura historicamente concedidos para o n8n nao sao mexidos aqui).
-- Guards to_regclass: licao do P1 documentado no MIGRATIONS_SYNC_LOG
-- (REVOKE em tabela production-only aborta replay em DB fresh).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'supplier_products_raw',
    'produtos_padronizacao_variantes',
    'cf_sm_legacy',
    'sm_upload_mapping',
    'xbz_gallery_staging'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM anon', t);
      RAISE NOTICE 'M6: escrita anon revogada em public.%', t;
    ELSE
      RAISE NOTICE 'M6: public.% nao existe - pulando', t;
    END IF;
  END LOOP;
END $$;
